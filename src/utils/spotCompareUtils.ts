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
}

export interface SpotComparisonParams {
  initialInvestment: number;
  currentPrice: number;
  targetPrice: number;
  leverage: number;
  fundingFees: number;
  timeHorizon: number;
  selectedScenario: TradingScenario;
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
  
  // Compare performance metrics
  const leveragedReturn = (leveragedPnL / params.initialInvestment) * 100;
  const spotReturn = (spotPnL / spotInvestment) * 100;
  const isFundingSignificant = params.fundingFees > Math.abs(spotPnL);
  const isLeverageWorthIt = leverageSharpe > spotSharpe && leveragedPnL > spotPnL;
  
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
    fundingDragPercent: (params.fundingFees / params.initialInvestment) * 100,
    scenarioAdjustedRisk
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
    title: 'Leverage vs Spot Comparison',
    description: `${params.leverage}x leveraged position ${
      comparison.isLeverageWorthIt 
        ? `outperforms spot with ${comparison.leveragedReturn.toFixed(1)}% vs ${comparison.spotReturn.toFixed(1)}% return` 
        : `underperforms spot with ${comparison.leveragedReturn.toFixed(1)}% vs ${comparison.spotReturn.toFixed(1)}% return`
    }. ${
      comparison.isFundingSignificant
        ? `Funding fees of $${params.fundingFees.toFixed(2)} significantly reduce leverage advantage.`
        : `Funding fees of $${params.fundingFees.toFixed(2)} are justified by increased returns.`
    } ${
      comparison.leverageSharpe > comparison.spotSharpe
        ? `Risk-adjusted returns favor leverage (${comparison.leverageSharpe.toFixed(2)} vs ${comparison.spotSharpe.toFixed(2)} Sharpe).`
        : `Risk-adjusted returns favor spot (${comparison.spotSharpe.toFixed(2)} vs ${comparison.leverageSharpe.toFixed(2)} Sharpe).`
    }`,
    severity: comparison.isLeverageWorthIt ? 'low' : 'medium',
    action: comparison.isLeverageWorthIt
      ? 'Current leverage setup appears optimal vs spot'
      : `Consider spot position instead - similar returns with lower risk and no funding costs`
  });

  // Scenario-specific recommendations
  switch (params.selectedScenario) {
    case "Sideways":
      if (!comparison.isLeverageWorthIt) {
        recommendations.push({
          type: 'opportunity',
          title: 'Spot Advantage in Sideways Market',
          description: `In sideways market, spot position avoids ${comparison.fundingDragPercent.toFixed(1)}% funding cost drag. ` +
            `Expected price movement may not justify leverage costs.`,
          severity: 'low',
          action: 'Consider spot position to avoid funding costs in ranging market'
        });
      }
      break;

    case "Exponential Pump":
    case "Parabolic":
      if (comparison.isLeverageWorthIt && params.timeHorizon > 30) {
        recommendations.push({
          type: 'opportunity',
          title: 'Leverage Advantage in Strong Trend',
          description: `In ${params.selectedScenario.toLowerCase()} scenario, ${params.leverage}x leverage amplifies returns by ${comparison.leverageMultiplier.toFixed(1)}x ` +
            `after funding costs. Strong trend justifies higher costs.`,
          severity: 'low',
          action: 'Current leverage appears optimal for capturing strong trend'
        });
      }
      break;

    case "Volatile Growth":
      recommendations.push({
        type: 'position',
        title: 'Position Sizing in Volatile Market',
        description: `Consider split position: ${
          comparison.isLeverageWorthIt 
            ? `${Math.round(100/params.leverage)}% leveraged, remainder in spot to optimize risk/reward.`
            : 'Majority in spot, small portion in leverage for upside exposure.'
        } Volatile market may present both spot accumulation and leverage opportunities.`,
        severity: 'low',
        action: 'Consider hybrid spot/leverage approach for volatile conditions'
      });
      break;
  }

  return recommendations;
}
