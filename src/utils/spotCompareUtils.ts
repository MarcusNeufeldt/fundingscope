import { TradingScenario } from '../types/scenarios';

// Import scenarios from ProfitLossChart
const scenarios = {
  Linear: {
    priceModifier: (day: number, baseReturn: number) => baseReturn * day,
    fundingModifier: (_: number, baseFunding: number) => baseFunding,
  },
  "Exponential Pump": {
    priceModifier: (day: number, baseReturn: number) => 
      baseReturn * Math.pow(day, 1.5) / Math.pow(day, 0.5),
    fundingModifier: (day: number, baseFunding: number, priceChange: number) => 
      baseFunding * (1 + Math.max(0, priceChange) * 2),
  },
  "Volatile Growth": {
    priceModifier: (day: number, baseReturn: number) => 
      baseReturn * day * (1 + 0.3 * Math.sin(day / 10)),
    fundingModifier: (day: number, baseFunding: number) => 
      baseFunding * (1 + 0.5 * Math.sin(day / 5)),
  },
  Sideways: {
    priceModifier: (day: number, baseReturn: number) => {
      const oscillation = Math.sin(day / 15) * 0.1;
      return baseReturn * day * 0.1 + oscillation;
    },
    fundingModifier: (day: number, baseFunding: number) => 
      baseFunding * (1 + 0.1 * Math.sin(day / 10)),
  },
  Parabolic: {
    priceModifier: (day: number, baseReturn: number) => 
      baseReturn * Math.pow(day / 100, 2),
    fundingModifier: (day: number, baseFunding: number, priceChange: number) => 
      baseFunding * (1 + Math.pow(day / 100, 1.5)),
  },
  Accumulation: {
    priceModifier: (day: number, baseReturn: number) => {
      const breakout = day > 50 ? Math.pow((day - 50) / 30, 2) : 0;
      return baseReturn * day * (0.2 + breakout);
    },
    fundingModifier: (day: number, baseFunding: number) => 
      baseFunding * (day > 50 ? 1 + Math.pow((day - 50) / 30, 1.5) : 0.5),
  },
  "Cascading Pump": {
    priceModifier: (day: number, baseReturn: number) => {
      const wave1 = Math.sin(day / 20) * Math.min(1, day / 30);
      const wave2 = Math.sin(day / 40) * Math.min(1, day / 60) * 2;
      const wave3 = Math.sin(day / 80) * Math.min(1, day / 90) * 4;
      return baseReturn * day * (1 + wave1 + wave2 + wave3);
    },
    fundingModifier: (day: number, baseFunding: number, priceChange: number) => 
      baseFunding * (1 + Math.abs(Math.sin(day / 20)) + Math.abs(priceChange)),
  },
  "Market Cycle": {
    priceModifier: (day: number, baseReturn: number) => {
      const phase = (day % 100) / 100;
      if (phase < 0.3) return baseReturn * day * 0.5;
      if (phase < 0.6) return baseReturn * day * (1 + Math.pow(phase, 2));
      if (phase < 0.8) return baseReturn * day * (1.5 - Math.pow(phase - 0.6, 2));
      return baseReturn * day * (1 - Math.pow(phase - 0.8, 2));
    },
    fundingModifier: (day: number, baseFunding: number, priceChange: number) => {
      const phase = (day % 100) / 100;
      return baseFunding * (1 + Math.abs(priceChange) * (phase < 0.6 ? 2 : 0.5));
    },
  },
};

export interface SpotComparisonResult {
  spotPnL: number;
  leveragedPnL: number;
  spotReturn: number;
  leveragedReturn: number;
  spotSharpe: number;
  leverageSharpe: number;
  isFundingSignificant: boolean;
  isLeverageWorthIt: boolean;
  leverageMultiplier: number;
  fundingDragPercent: number;
  scenarioAdjustedRisk: number;
  liquidationRisk: number;
  marginBuffer: number;
}

export interface SpotComparisonParams {
  initialInvestment: number;
  currentPrice: number;
  targetPrice: number;
  leverage: number;
  fundingFees: number;
  timeHorizon: number;
  selectedScenario: TradingScenario;
  isLong?: boolean;
}

function calculateLiquidationDetails(currentPrice: number, leverage: number, positionSize: number, isLong: boolean): { liquidationDistancePercent: number, maintenanceMarginRequired: number } {
  // TO DO: implement liquidation details calculation
  return { liquidationDistancePercent: 0, maintenanceMarginRequired: 0 };
}

export function calculateSpotComparison(params: SpotComparisonParams): SpotComparisonResult {
  const scenario = scenarios[params.selectedScenario];
  const expectedReturnPerc = ((params.targetPrice - params.currentPrice) / params.currentPrice);
  const baseDailyReturnPerc = expectedReturnPerc / params.timeHorizon;

  // Calculate scenario-adjusted price movement
  const finalDayPriceMove = scenario.priceModifier(params.timeHorizon, baseDailyReturnPerc);
  const spotPriceAtTarget = params.currentPrice * (1 + finalDayPriceMove);
  
  const spotInvestment = params.initialInvestment;
  const spotPnL = spotInvestment * ((spotPriceAtTarget - params.currentPrice) / params.currentPrice);
  const leveragedPnL = (spotPnL * params.leverage) - params.fundingFees;
  
  // Calculate scenario-adjusted risk
  const scenarioRiskMultiplier = getScenarioRiskMultiplier(params.selectedScenario);
  const baseVolatility = Math.abs(finalDayPriceMove) * 100;
  const scenarioAdjustedRisk = baseVolatility * scenarioRiskMultiplier;
  
  // Calculate risk-adjusted returns with scenario volatility
  const spotRisk = scenarioAdjustedRisk;
  const leverageRisk = spotRisk * params.leverage;
  const spotSharpe = spotPnL / (spotRisk * spotInvestment);
  const leverageSharpe = leveragedPnL / (leverageRisk * params.initialInvestment);
  
  // Calculate liquidation risk
  const { liquidationDistancePercent, maintenanceMarginRequired } = calculateLiquidationDetails(
    params.currentPrice,
    params.leverage,
    params.initialInvestment * params.leverage,
    params.isLong ?? true
  );
  
  // Calculate effective margin after funding fees
  const effectiveMargin = params.initialInvestment - params.fundingFees;
  const marginBuffer = effectiveMargin - maintenanceMarginRequired;
  const marginBufferPercent = (marginBuffer / params.initialInvestment) * 100;
  
  // Assess funding impact relative to position size and PnL
  const fundingToPositionRatio = (params.fundingFees / params.initialInvestment) * 100;
  const fundingToPnLRatio = params.fundingFees / Math.abs(leveragedPnL);
  
  // Compare performance metrics
  const leveragedReturn = (leveragedPnL / params.initialInvestment) * 100;
  const spotReturn = (spotPnL / spotInvestment) * 100;
  
  // Enhanced decision metrics
  const isFundingSignificant = (fundingToPositionRatio > 2 && fundingToPnLRatio > 0.5); // Only if BOTH position AND PnL impact are high
  const hasAdequateMargin = marginBufferPercent > 20; // >20% buffer above maintenance margin
  const hasPositiveRiskAdjustedReturn = leveragedReturn > spotReturn * (params.leverage * 0.15); // Should capture at least 15% of theoretical max

  const isLeverageWorthIt = leveragedReturn > spotReturn * 1.5 && // 50% better than spot
                           hasAdequateMargin &&
                           (
                             !isFundingSignificant || // Either funding is not significant
                             (leveragedReturn > spotReturn * 3) // Or returns are 3x better despite high funding
                           );
  
  return {
    spotPnL,
    leveragedPnL,
    spotReturn,
    leveragedReturn,
    spotSharpe,
    leverageSharpe,
    isFundingSignificant,
    isLeverageWorthIt,
    leverageMultiplier: leveragedPnL / spotPnL,
    fundingDragPercent: fundingToPositionRatio,
    scenarioAdjustedRisk,
    liquidationRisk: liquidationDistancePercent,
    marginBuffer: marginBufferPercent
  };
}

// Risk multipliers based on scenario characteristics
function getScenarioRiskMultiplier(scenario: TradingScenario): number {
  switch (scenario) {
    case "Linear":
      return 1.0;
    case "Exponential Pump":
      return 1.8;
    case "Volatile Growth":
      return 1.5;
    case "Sideways":
      return 0.8;
    case "Parabolic":
      return 2.0;
    case "Accumulation":
      return 1.2;
    case "Cascading Pump":
      return 1.6;
    case "Market Cycle":
      return 1.4;
    default:
      return 1.0;
  }
}

export function getSpotComparisonRecommendations(
  comparison: SpotComparisonResult,
  params: SpotComparisonParams
) {
  const recommendations = [];

  // Base comparison recommendation
  recommendations.push({
    type: 'position',
    title: 'Leverage vs Spot Performance',
    description: `${params.leverage}x leverage ${
      comparison.isLeverageWorthIt 
        ? `amplifies returns ${(comparison.leveragedReturn/comparison.spotReturn).toFixed(1)}x (${comparison.leveragedReturn.toFixed(1)}% vs ${comparison.spotReturn.toFixed(1)}%)` 
        : `yields ${comparison.leveragedReturn.toFixed(1)}% vs spot's ${comparison.spotReturn.toFixed(1)}%`
    }. ${
      comparison.isFundingSignificant
        ? `High funding cost (${comparison.fundingDragPercent.toFixed(1)}% of position) is offset by ${(comparison.leveragedReturn/comparison.spotReturn).toFixed(1)}x return multiplier.`
        : `Funding cost at ${comparison.fundingDragPercent.toFixed(1)}% of position is reasonable for the returns.`
    } Strong margin buffer at ${comparison.marginBuffer.toFixed(1)}%.`,
    severity: 'low',
    action: comparison.isLeverageWorthIt
      ? `Maintain ${params.leverage}x leverage - returns justify costs with adequate safety margin`
      : `Consider ${comparison.marginBuffer < 30 ? 'reducing leverage to increase margin buffer' : 
          comparison.isFundingSignificant ? 'lower leverage to reduce funding impact' : 'adjusting position size'}`
  });

  // Scenario-specific recommendations
  switch (params.selectedScenario) {
    case "Sideways":
      if (comparison.fundingDragPercent > 1.5) {
        recommendations.push({
          type: 'risk',
          title: 'High Funding Impact in Range',
          description: `Ranging market with ${comparison.fundingDragPercent.toFixed(1)}% funding drag reduces profitability. ` +
            `Consider spot's ${comparison.spotReturn.toFixed(1)}% return with no funding costs.`,
          severity: 'medium',
          action: 'Reduce leverage or switch to spot to minimize funding impact'
        });
      }
      break;

    case "Exponential Pump":
    case "Parabolic":
      if (comparison.leveragedReturn > comparison.spotReturn * 1.5 && comparison.marginBuffer > 40) {
        recommendations.push({
          type: 'opportunity',
          title: 'Strong Trend Leverage Setup',
          description: `${params.leverage}x leverage amplifies returns ${(comparison.leveragedReturn/comparison.spotReturn).toFixed(1)}x ` +
            `with healthy ${comparison.marginBuffer.toFixed(1)}% margin buffer and manageable ${comparison.fundingDragPercent.toFixed(1)}% funding cost.`,
          severity: 'low',
          action: 'Maintain leverage position with strong risk management'
        });
      }
      break;

    case "Volatile Growth":
      if (comparison.leveragedReturn > comparison.spotReturn && comparison.marginBuffer > 35) {
        recommendations.push({
          type: 'opportunity',
          title: 'Optimized Risk-Reward Setup',
          description: `${params.leverage}x leverage provides ${(comparison.leveragedReturn/comparison.spotReturn).toFixed(1)}x return ` +
            `with ${comparison.marginBuffer.toFixed(1)}% safety margin. Volatility well-managed.`,
          severity: 'low',
          action: 'Position sized appropriately for market conditions'
        });
      }
      break;
  }

  return recommendations;
}
