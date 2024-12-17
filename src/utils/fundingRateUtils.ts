// Types for funding rate calculations
export interface FundingRateImpact {
  fundingFees: number;
  effectiveMargin: number;
  liquidationRisk: number;  // 0-100 scale
  isLiquidated: boolean;
  liquidationPeriod?: number;
  liquidationDetails?: LiquidationDetails;
  calculations: {
    fundingPerPeriod: number;
    totalFundingFees: number;
    maintenanceMargin: number;
    marginBuffer: number;
  };
}

export interface MarginDetails {
  initialMargin: number;
  maintenanceMargin: number;
  currentMargin: number;
}

import { calculateLiquidationDetails, LiquidationDetails } from './liquidationUtils';

// Cache for liquidation points to avoid recalculation
const liquidationCache = new Map<string, number>();

// Calculate funding rate impact on position
export const calculateFundingImpact = (
  positionSize: number,
  fundingRate: number,
  periods: number,
  leverage: number,
  initialMargin: number,
  currentPrice: number,
  isLong: boolean = true
): FundingRateImpact => {
  console.log('\n=== Funding Impact Calculation ===');
  console.log(`Input Parameters:
  Position Size: $${positionSize}
  Funding Rate: ${fundingRate}%
  Number of 8h Periods: ${periods}
  Leverage: ${leverage}x
  Initial Margin: $${initialMargin}
  Current Price: $${currentPrice}
  Direction: ${isLong ? 'Long' : 'Short'}`);

  // Calculate liquidation details first
  const liquidationDetails = calculateLiquidationDetails(currentPrice, leverage, positionSize, isLong);
  
  // Check cache for liquidation point
  const cacheKey = `${positionSize}-${fundingRate}-${leverage}-${initialMargin}-${currentPrice}-${isLong}`;
  let liquidationPeriod = liquidationCache.get(cacheKey);
  let isLiquidated = false;

  // Calculate funding fees with decay
  let totalFundingFees = 0;
  let currentPositionSize = positionSize;
  let effectiveMargin = initialMargin;
  
  // If we know the liquidation period, use it
  const periodsToCalculate = liquidationPeriod ? Math.min(periods, liquidationPeriod) : periods;
  
  for (let i = 0; i < periodsToCalculate; i++) {
    const fundingPerPeriod = currentPositionSize * (fundingRate / 100);
    effectiveMargin = initialMargin - totalFundingFees;
    
    // Check if position would be liquidated based on effective margin
    if (effectiveMargin <= liquidationDetails.maintenanceMarginRequired) {
      isLiquidated = true;
      liquidationPeriod = i;
      // Cache the liquidation point
      liquidationCache.set(cacheKey, i);
      console.log(`\nPosition Liquidated at period ${i}
      Effective Margin ($${effectiveMargin.toFixed(4)}) <= Maintenance Margin ($${liquidationDetails.maintenanceMarginRequired.toFixed(4)})`);
      break;
    }
    
    totalFundingFees += fundingPerPeriod;
    // Reduce position size proportionally to maintain leverage
    currentPositionSize = positionSize * (effectiveMargin / initialMargin);
  }

  // If we're past the liquidation point, use the liquidation values
  if (liquidationPeriod && periods > liquidationPeriod) {
    isLiquidated = true;
    effectiveMargin = 0;
    totalFundingFees = initialMargin; // Maximum loss is initial margin
  }

  const fundingPerPeriod = positionSize * (fundingRate / 100);
  console.log(`\nInitial Funding Per Period: $${fundingPerPeriod.toFixed(4)} 
  Calculation: Initial Position Size ($${positionSize}) × (Funding Rate (${fundingRate}) / 100)`);

  console.log(`\nTotal Funding Fees: $${totalFundingFees.toFixed(4)}
  Calculation: Accumulated over ${isLiquidated ? 'until liquidation' : periods} periods with declining position size`);

  console.log(`\nEffective Margin: $${effectiveMargin.toFixed(4)}
  Calculation: Initial Margin ($${initialMargin}) - Total Funding Fees ($${totalFundingFees.toFixed(4)})`);

  const marginBuffer = effectiveMargin - liquidationDetails.maintenanceMarginRequired;
  console.log(`\nMargin Buffer: $${marginBuffer.toFixed(4)}
  Calculation: Effective Margin ($${effectiveMargin.toFixed(4)}) - Maintenance Margin ($${liquidationDetails.maintenanceMarginRequired.toFixed(4)})`);

  // For 1x leverage, base risk purely on remaining margin percentage
  const liquidationRisk = isLiquidated ? 100 : leverage === 1 
    ? Math.max(0, Math.min(100, ((initialMargin - effectiveMargin) / initialMargin) * 100))
    : Math.max(0, Math.min(100, (1 - (marginBuffer / initialMargin)) * 100));
  
  console.log(`\nLiquidation Risk: ${liquidationRisk.toFixed(2)}%
  Calculation: ${isLiquidated 
    ? 'Position Liquidated' 
    : leverage === 1
      ? `Remaining margin percentage: ((Initial Margin ($${initialMargin}) - Effective Margin ($${effectiveMargin.toFixed(4)})) / Initial Margin) × 100`
      : `max(0, min(100, (1 - (Margin Buffer ($${marginBuffer.toFixed(4)}) / Initial Margin ($${initialMargin}))) × 100))`}`);

  console.log('\n=== End Calculation ===\n');

  return {
    fundingFees: totalFundingFees,
    effectiveMargin: Math.max(0, effectiveMargin),
    liquidationRisk,
    isLiquidated,
    liquidationPeriod: isLiquidated ? liquidationPeriod : undefined,
    liquidationDetails,
    calculations: {
      fundingPerPeriod,
      totalFundingFees,
      maintenanceMargin: liquidationDetails.maintenanceMarginRequired,
      marginBuffer
    }
  };
};

// Calculate maintenance margin requirement
export const calculateMaintenanceMargin = (
  positionSize: number,
  leverage: number
): number => {
  const maintenanceMargin = positionSize * (0.005 * leverage);
  console.log(`\n=== Maintenance Margin Calculation ===
  Position Size: $${positionSize}
  Leverage: ${leverage}x
  Maintenance Margin: $${maintenanceMargin.toFixed(4)}
  Calculation: Position Size ($${positionSize}) × (0.005 × Leverage (${leverage}))
=== End Calculation ===\n`);
  return maintenanceMargin;
};

// Check if position needs margin top-up
export const needsMarginTopUp = (
  currentMargin: number,
  maintenanceMargin: number,
  buffer: number = 1.2 // 20% buffer above maintenance margin
): boolean => {
  const result = currentMargin < (maintenanceMargin * buffer);
  console.log(`\n=== Margin Top-up Check ===
  Current Margin: $${currentMargin}
  Maintenance Margin: $${maintenanceMargin}
  Buffer: ${buffer} (${(buffer-1)*100}% above maintenance)
  Required Margin with Buffer: $${(maintenanceMargin * buffer).toFixed(4)}
  Needs Top-up: ${result}
=== End Check ===\n`);
  return result;
};

// Calculate raw PnL without funding impact
export function calculateRawPnL(
  positionSize: number,
  entryPrice: number,
  currentPrice: number,
  isLong: boolean = true
): number {
  const priceDifference = currentPrice - entryPrice;
  const rawPnL = isLong ? 
    (priceDifference / entryPrice) * positionSize :
    (-priceDifference / entryPrice) * positionSize;
  return rawPnL;
}
