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
  const isHighRisk = comparison.liquidationRisk > 75 || comparison.marginBuffer < 20;
  const riskAssessment = isHighRisk 
    ? `WARNING: Projected margin buffer of ${comparison.marginBuffer.toFixed(1)}% indicates high liquidation risk.`
    : comparison.marginBuffer < 40
    ? `Projected margin buffer of ${comparison.marginBuffer.toFixed(1)}% may be insufficient for market volatility.`
    : `Projected margin buffer of ${comparison.marginBuffer.toFixed(1)}% provides adequate safety.`;

  recommendations.push({
    type: isHighRisk ? 'critical' : 'position',
    title: 'Projected Leverage vs Spot Returns',
    description: `${params.leverage}x leverage strategy ${
      comparison.isLeverageWorthIt 
        ? `projects ${(comparison.leveragedReturn/comparison.spotReturn).toFixed(1)}x amplified returns (${comparison.leveragedReturn.toFixed(1)}% vs spot's ${comparison.spotReturn.toFixed(1)}%)` 
        : `would yield ${comparison.leveragedReturn.toFixed(1)}% vs projected spot return of ${comparison.spotReturn.toFixed(1)}%`
    }. ${
      comparison.isFundingSignificant
        ? `Estimated funding costs (${comparison.fundingDragPercent.toFixed(1)}% of position) would significantly impact profitability.`
        : `Projected funding costs of ${comparison.fundingDragPercent.toFixed(1)}% would affect returns.`
    } ${riskAssessment}`,
    severity: isHighRisk ? 'high' : comparison.marginBuffer < 40 ? 'medium' : 'low',
    action: isHighRisk
      ? 'Consider lower leverage or higher margin to mitigate liquidation risk'
      : comparison.marginBuffer < 40
      ? 'Plan for a larger margin buffer to handle market movements'
      : 'Ensure proper risk management if executing this strategy'
  });

  // Scenario-specific recommendations
  switch (params.selectedScenario) {
    case "Sideways":
      if (comparison.fundingDragPercent > 1.5) {
        recommendations.push({
          type: 'risk',
          title: 'High Projected Funding in Range',
          description: `In a ranging market scenario, estimated funding drag of ${comparison.fundingDragPercent.toFixed(1)}% would reduce profitability. ` +
            `A spot position would target ${comparison.spotReturn.toFixed(1)}% return without funding costs or liquidation risks.`,
          severity: 'medium',
          action: 'Consider spot strategy to avoid funding costs and liquidation risks'
        });
      }
      break;

    case "Exponential Pump":
    case "Parabolic":
      if (comparison.leveragedReturn > comparison.spotReturn * 1.5) {
        recommendations.push({
          type: comparison.marginBuffer < 40 ? 'risk' : 'opportunity',
          title: `${comparison.marginBuffer < 40 ? 'High Risk' : 'Potential'} Trend Strategy`,
          description: `${params.leverage}x leverage could amplify returns ${(comparison.leveragedReturn/comparison.spotReturn).toFixed(1)}x ` +
            `with a ${comparison.marginBuffer < 40 ? 'thin' : 'projected'} ${comparison.marginBuffer.toFixed(1)}% margin buffer. ` +
            `Expected funding cost of ${comparison.fundingDragPercent.toFixed(1)}% ${comparison.marginBuffer < 40 ? 'would increase liquidation risk.' : 'should be monitored.'}`,
          severity: comparison.marginBuffer < 40 ? 'high' : 'medium',
          action: comparison.marginBuffer < 40 
            ? 'Consider lower leverage or higher margin if pursuing this strategy'
            : 'Plan for active risk management if implementing'
        });
      }
      break;

    case "Volatile Growth":
      if (comparison.leveragedReturn > comparison.spotReturn) {
        recommendations.push({
          type: comparison.marginBuffer < 35 ? 'risk' : 'opportunity',
          title: `${comparison.marginBuffer < 35 ? 'High Risk' : 'Balanced'} Strategy Profile`,
          description: `${params.leverage}x leverage strategy targets ${(comparison.leveragedReturn/comparison.spotReturn).toFixed(1)}x return ` +
            `with projected ${comparison.marginBuffer.toFixed(1)}% margin buffer in volatile conditions. ` +
            `${comparison.marginBuffer < 35 ? 'Expected volatility poses significant liquidation risk.' : 'Buffer should accommodate expected volatility.'}`,
          severity: comparison.marginBuffer < 35 ? 'high' : 'medium',
          action: comparison.marginBuffer < 35
            ? 'Plan for larger margin buffer to handle projected volatility'
            : 'Prepare risk management strategy before implementing'
        });
      }
      break;
  }

  return recommendations;
}
