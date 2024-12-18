import React from "react";
import { Card } from "@/components/ui/card";
import { TradingParams } from "./InputForm";
import { AlertCircle, TrendingUp, Shield, Clock, DollarSign, Target, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { calculateLiquidationDetails } from "@/utils/liquidationUtils";
import { calculateFundingImpact } from "@/utils/fundingRateUtils";
import { calculateSpotComparison, getSpotComparisonRecommendations } from '../utils/spotCompareUtils';
import { TradingScenario } from "../types/scenarios";

interface RecommendationItem {
  type: 'risk' | 'opportunity' | 'safety' | 'timing' | 'position' | 'target' | 'critical';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  action?: string;
}

interface RecommendationsContainerProps {
  params: TradingParams;
  currentPnL: number;
  liquidationRisk: number;
  effectiveMargin: number;
  selectedScenario: TradingScenario;
}

const getRecommendations = (
  params: TradingParams,
  currentPnL: number,
  liquidationRisk: number,
  effectiveMargin: number,
  selectedScenario: TradingScenario
): RecommendationItem[] => {
  const recommendations: RecommendationItem[] = [];
  
  // Calculate important metrics
  const positionSize = params.initialInvestment * params.leverage;
  const liquidationDetails = calculateLiquidationDetails(
    params.currentPrice,
    params.leverage,
    positionSize,
    params.targetPrice > params.currentPrice // isLong
  );
  
  const priceMove = ((params.targetPrice - params.currentPrice) / params.currentPrice) * 100;
  const annualizedFunding = params.fundingRate * 1095; // Approximate annual rate (365 * 3)
  const dailyFundingCost = (positionSize * params.fundingRate * 3) / 100; // Daily funding cost
  const marginUtilization = (effectiveMargin / params.initialInvestment) * 100;
  const isLong = params.targetPrice > params.currentPrice;

  // Calculate projected funding impact
  const fundingImpact = calculateFundingImpact(
    positionSize,
    params.fundingRate,
    params.timeHorizon * 3, // Convert days to 8h periods
    params.leverage,
    params.initialInvestment,
    params.currentPrice,
    isLong
  );

  // Early warning if position will be liquidated by funding
  if (fundingImpact.isLiquidated && fundingImpact.liquidationPeriod !== undefined) {
    const daysUntilLiquidation = Math.floor(fundingImpact.liquidationPeriod / 3); // Convert periods to days
    const marginAtLiquidation = fundingImpact.calculations.maintenanceMargin;
    const daysToHalfMargin = Math.floor((daysUntilLiquidation * params.initialInvestment) / (2 * fundingImpact.calculations.totalFundingFees));
    
    recommendations.unshift({
      type: 'critical',
      title: 'Warning: Funding Fees Will Cause Liquidation',
      description: `Position will be liquidated on day ${daysUntilLiquidation} due to funding fees depleting margin. ` +
        `Initial margin of $${params.initialInvestment.toFixed(2)} will be reduced to maintenance requirement of $${marginAtLiquidation.toFixed(2)} ` +
        `through daily funding costs of ${(dailyFundingCost / effectiveMargin * 100).toFixed(2)}% of margin. ` +
        `Half of margin will be depleted by day ${daysToHalfMargin}.`,
      severity: 'high',
      action: daysUntilLiquidation < params.timeHorizon / 2 
        ? 'Urgently reduce position timeframe or increase margin to prevent funding-induced liquidation'
        : 'Consider reducing timeframe or increasing initial margin to maintain position'
    });
  }
  // Warning about significant funding impact even if not liquidating
  else if (fundingImpact.liquidationRisk > 50) {
    const marginBufferDays = Math.floor(fundingImpact.calculations.marginBuffer / dailyFundingCost);
    const marginBufferPercent = (fundingImpact.calculations.marginBuffer / params.initialInvestment) * 100;
    
    recommendations.push({
      type: 'risk',
      title: 'High Funding Impact on Margin',
      description: `Funding fees will significantly impact position profitability. ` +
        `Current margin buffer of $${fundingImpact.calculations.marginBuffer.toFixed(2)} (${marginBufferPercent.toFixed(1)}% of initial margin) ` +
        `provides approximately ${marginBufferDays} days of funding cost coverage. ` +
        `Liquidation risk is ${fundingImpact.liquidationRisk.toFixed(1)}%.`,
      severity: fundingImpact.liquidationRisk > 75 ? 'high' : 'medium',
      action: marginBufferDays < params.timeHorizon / 2
        ? 'Increase margin buffer or reduce position duration to maintain safe distance from liquidation'
        : 'Monitor funding rates closely and consider taking profit if rates increase'
    });
  }

  // Add scenario-specific funding warnings based on actual calculations
  const fundingToMarginRatio = fundingImpact.calculations.fundingPerPeriod / params.initialInvestment;
  switch (selectedScenario) {
    case "Sideways":
      if (fundingToMarginRatio > 0.01) { // More than 1% per period
        recommendations.push({
          type: 'risk',
          title: 'High Funding Cost in Sideways Market',
          description: `Funding cost of ${(fundingToMarginRatio * 100).toFixed(2)}% per 8h period is significant in sideways market. ` +
            `Total projected funding of $${fundingImpact.calculations.totalFundingFees.toFixed(2)} may exceed potential gains from ${Math.abs(priceMove).toFixed(1)}% price movement.`,
          severity: fundingToMarginRatio > 0.02 ? 'high' : 'medium',
          action: 'Consider shorter timeframe or lower leverage in sideways market'
        });
      }
      break;

    case "Exponential Pump":
    case "Parabolic":
      const breakevenMove = (fundingImpact.calculations.totalFundingFees / positionSize) * 100;
      if (breakevenMove > 5) {
        recommendations.push({
          type: 'position',
          title: 'High Funding Cost in Bull Scenario',
          description: `Need ${breakevenMove.toFixed(1)}% price movement to break even on funding costs of $${fundingImpact.calculations.totalFundingFees.toFixed(2)}. ` +
            `${selectedScenario} scenario typically sees strong moves that could justify these costs if momentum continues.`,
          severity: breakevenMove > 10 ? 'medium' : 'low',
          action: 'Monitor funding rates closely and consider taking profit if momentum weakens'
        });
      }
      break;
  }

  // Calculate cumulative funding impact
  const totalFundingCost = dailyFundingCost * params.timeHorizon;
  
  // Calculate the maximum funding loss before liquidation
  const maintenanceMargin = liquidationDetails.maintenanceMarginRequired;
  const marginToLiquidation = effectiveMargin - maintenanceMargin;
  const daysToLiquidation = marginToLiquidation / dailyFundingCost;
  
  // Funding rate impact on margin over time
  if (params.timeHorizon > 7) {
    // Get scenario-specific funding multiplier
    const fundingMultiplier = {
      "Exponential Pump": 2,
      "Volatile Growth": 1.5,
      "Sideways": 1,
      "Parabolic": 2.5,
      "Accumulation": 0.8,
      "Cascading Pump": 1.8,
      "Market Cycle": 1.3,
      "Linear": 1
    }[selectedScenario] || 1;

    const adjustedFundingCost = Math.min(totalFundingCost * fundingMultiplier, marginToLiquidation);
    const adjustedMarginDepletion = (adjustedFundingCost / effectiveMargin) * 100;

    if (adjustedMarginDepletion > 15) {
      recommendations.push({
        type: 'timing',
        title: 'Significant Funding Impact on Margin',
        description: `In ${selectedScenario.toLowerCase()} scenario, funding fees would consume ${adjustedMarginDepletion.toFixed(1)}% of your available margin over ${params.timeHorizon} days. ${
          daysToLiquidation < params.timeHorizon 
            ? `WARNING: Position would be liquidated after ${Math.floor(daysToLiquidation)} days due to funding fees alone.`
            : `Daily funding cost is ${(dailyFundingCost / effectiveMargin * 100).toFixed(2)}% of your margin.`
        }`,
        severity: daysToLiquidation < params.timeHorizon ? 'high' : 
                 adjustedMarginDepletion > 30 ? 'medium' : 'low',
        action: daysToLiquidation < params.timeHorizon 
          ? 'Reduce position timeframe to prevent funding-induced liquidation'
          : 'Consider reducing timeframe or increasing margin to account for funding costs'
      });
    }

    // Add scenario-specific funding warnings
    switch (selectedScenario) {
      case "Sideways":
        if (marginUtilization > 10) {
          recommendations.push({
            type: 'risk',
            title: 'Funding Erosion in Sideways Market',
            description: `With limited price movement in sideways market, funding fees (${marginUtilization.toFixed(1)}% of margin) could exceed potential gains. Break-even requires ${(marginUtilization / 2).toFixed(1)}% price movement.`,
            severity: marginUtilization > 20 ? 'high' : 'medium',
            action: 'Consider shorter timeframe or lower leverage in sideways market'
          });
        }
        break;

      case "Exponential Pump":
      case "Parabolic":
        const breakevenMove = (adjustedFundingCost / positionSize) * 100;
        if (breakevenMove > 5) {
          recommendations.push({
            type: 'position',
            title: 'High Funding Cost in Bull Scenario',
            description: `Need ${breakevenMove.toFixed(1)}% price movement just to break even on funding costs. However, ${selectedScenario.toLowerCase()} scenario could justify these costs if momentum continues.`,
            severity: breakevenMove > 10 ? 'medium' : 'low',
            action: 'Monitor funding rates closely and consider taking profit if momentum weakens'
          });
        }
        break;

      case "Volatile Growth":
        const worstCaseFunding = adjustedFundingCost * 1.5; // Account for funding spikes
        if (worstCaseFunding / effectiveMargin > 0.25) {
          recommendations.push({
            type: 'risk',
            title: 'Funding Risk in Volatile Market',
            description: `Volatile markets often see funding rate spikes. Worst-case funding could reach ${((worstCaseFunding / effectiveMargin) * 100).toFixed(1)}% of margin over ${params.timeHorizon} days.`,
            severity: 'medium',
            action: 'Build larger margin buffer or reduce position size to account for funding spikes'
          });
        }
        break;

      case "Market Cycle":
        const cycleLength = 100; // days
        const cyclesSpanned = params.timeHorizon / cycleLength;
        if (cyclesSpanned > 0.5) {
          recommendations.push({
            type: 'timing',
            title: 'Funding Across Market Cycles',
            description: `Position spans ${cyclesSpanned.toFixed(1)} market cycles. Funding rates typically peak during euphoric phases, adding ${(adjustedMarginDepletion * 1.5).toFixed(1)}% potential margin erosion.`,
            severity: cyclesSpanned > 1 ? 'medium' : 'low',
            action: 'Consider breaking position into smaller timeframes aligned with cycle phases'
          });
        }
        break;
    }
  }

  // Calculate projected funding impact
  const currentPnLWithFunding = currentPnL - totalFundingCost;
  
  // Calculate expected price movement PnL
  const targetPriceMove = ((params.targetPrice - params.currentPrice) / params.currentPrice) * 100;
  const expectedPnL = (targetPriceMove * positionSize) / 100;
  
  // Get scenario-specific characteristics
  const scenarioCharacteristics = {
    "Exponential Pump": { pnlMult: 1.5, fundingRisk: 'high', peakDay: 45 },
    "Volatile Growth": { pnlMult: 1.2, fundingRisk: 'medium', peakDay: 30 },
    "Sideways": { pnlMult: 0.5, fundingRisk: 'low', peakDay: 0 },
    "Parabolic": { pnlMult: 2.0, fundingRisk: 'high', peakDay: 60 },
    "Accumulation": { pnlMult: 0.8, fundingRisk: 'low', peakDay: 50 },
    "Cascading Pump": { pnlMult: 1.3, fundingRisk: 'medium', peakDay: 45 },
    "Market Cycle": { pnlMult: 1.0, fundingRisk: 'medium', peakDay: 40 },
    "Linear": { pnlMult: 1.0, fundingRisk: 'low', peakDay: 0 }
  }[selectedScenario] || { pnlMult: 1.0, fundingRisk: 'medium', peakDay: 0 };
  
  // Adjust expected PnL based on scenario and time horizon
  const timeToExpectedPeak = Math.max(0, scenarioCharacteristics.peakDay - params.timeHorizon);
  const timeBasedPnLMultiplier = timeToExpectedPeak > 0 ? 0.7 : 1.0; // Reduce expected PnL if exiting before peak
  const scenarioAdjustedPnL = expectedPnL * scenarioCharacteristics.pnlMult * timeBasedPnLMultiplier;
  
  // Calculate if funding is significantly impacting profitability
  const fundingToExpectedPnLRatio = totalFundingCost / Math.abs(scenarioAdjustedPnL);
  const isFundingSignificant = fundingToExpectedPnLRatio > 0.5 && // Funding costs more than 50% of expected gains
                              scenarioCharacteristics.fundingRisk !== 'low' && // Not a low funding risk scenario
                              currentPnLWithFunding < 0; // Currently showing losses
  
  // Early warning about projected funding impact - only show if funding costs are significant relative to expected gains
  if (isFundingSignificant) {
    recommendations.unshift({
      type: 'critical',
      title: 'Warning: High Funding Cost Impact',
      description: `In the ${selectedScenario.toLowerCase()} scenario, funding fees (${totalFundingCost.toFixed(2)} USDT) would consume ${(fundingToExpectedPnLRatio * 100).toFixed(1)}% of your expected gains${
        timeToExpectedPeak > 0 ? ` before reaching the typical peak around day ${scenarioCharacteristics.peakDay}` : ''
      }. ${
        daysToLiquidation < params.timeHorizon 
          ? `Position risks liquidation around day ${Math.floor(daysToLiquidation)} due to funding fees alone.`
          : `Consider if the ${(dailyFundingCost / effectiveMargin * 100).toFixed(2)}% daily funding cost is justified by the expected price movement.`
      }`,
      severity: fundingToExpectedPnLRatio > 0.8 ? 'high' : 'medium',
      action: timeToExpectedPeak > 0 
        ? `Consider extending timeframe to day ${scenarioCharacteristics.peakDay} to capture full movement potential`
        : 'Consider reducing leverage to improve funding efficiency'
    });
  }

  // Scenario-specific recommendations
  switch (selectedScenario) {
    case "Exponential Pump":
      if (params.timeHorizon < 30 && isLong) {
        recommendations.push({
          type: 'timing',
          title: 'Short Timeframe in Pump Scenario',
          description: `Exponential growth typically needs time to develop. ${params.timeHorizon} days might be too short to capture the full momentum.`,
          severity: 'medium',
          action: 'Consider extending timeframe to capture potential exponential growth'
        });
      }
      if (params.leverage < 2 && isLong) {
        recommendations.push({
          type: 'opportunity',
          title: 'Conservative Leverage in Bullish Scenario',
          description: `Current ${params.leverage}x leverage is conservative for an exponential growth scenario. Room for optimization if confident in direction.`,
          severity: 'low',
          action: 'Explore higher leverage scenarios while maintaining risk management'
        });
      }
      break;

    case "Volatile Growth":
      if (params.leverage > 5) {
        recommendations.push({
          type: 'risk',
          title: 'High Leverage in Volatile Market',
          description: `${params.leverage}x leverage is risky in a volatile scenario. Periodic corrections of 30% could trigger liquidation.`,
          severity: 'high',
          action: 'Consider reducing leverage to account for expected volatility'
        });
      }
      break;

    case "Sideways":
      if (Math.abs(priceMove) > 20) {
        recommendations.push({
          type: 'target',
          title: 'Ambitious Target in Sideways Market',
          description: `Target of ${priceMove > 0 ? '+' : '-'}${Math.abs(priceMove).toFixed(1)}% might be optimistic in a sideways scenario with expected ±10% oscillations.`,
          severity: 'medium',
          action: 'Consider setting more conservative targets around ±5-15%'
        });
      }
      if (params.timeHorizon > 14 && params.leverage > 3) {
        recommendations.push({
          type: 'timing',
          title: 'Extended Sideways Exposure',
          description: `Long timeframe (${params.timeHorizon} days) with ${params.leverage}x leverage in sideways market could lead to significant funding costs eating into potential gains.`,
          severity: 'medium',
          action: 'Consider shorter timeframes or lower leverage for sideways scenarios'
        });
      }
      break;

    case "Parabolic":
      if (isLong && params.timeHorizon < 60) {
        recommendations.push({
          type: 'timing',
          title: 'Short Timeframe for Parabolic Growth',
          description: `Parabolic moves typically need 60+ days to develop. Current ${params.timeHorizon}-day timeframe might be too short.`,
          severity: 'medium',
          action: 'Consider extending timeframe to capture full parabolic movement'
        });
      }
      break;

    case "Accumulation":
      if (params.timeHorizon < 50 && isLong) {
        recommendations.push({
          type: 'timing',
          title: 'Early Exit in Accumulation Phase',
          description: `Breakout expected after day 50, but current timeframe is ${params.timeHorizon} days. Might miss the main move.`,
          severity: 'medium',
          action: 'Consider extending timeframe beyond day 50 to capture breakout'
        });
      }
      break;

    case "Cascading Pump":
      const wavePeriod = 20;
      if (params.timeHorizon % wavePeriod < wavePeriod / 2) {
        recommendations.push({
          type: 'timing',
          title: 'Wave Cycle Timing',
          description: `Timeframe of ${params.timeHorizon} days might end during a corrective wave. Consider adjusting to align with pump cycles.`,
          severity: 'low',
          action: 'Align timeframe with wave cycles (multiples of 20 days)'
        });
      }
      break;

    case "Market Cycle":
      if (params.timeHorizon > 100) {
        recommendations.push({
          type: 'timing',
          title: 'Multiple Cycle Exposure',
          description: `Timeframe spans multiple market cycles. Consider that each cycle has different optimal strategies.`,
          severity: 'medium',
          action: 'Consider breaking position into multiple trades aligned with cycle phases'
        });
      }
      break;
  }

  // Position Size and Leverage Analysis - adjusted for scenario
  if (params.leverage > 1) {
    const leverageRisk = (dailyFundingCost / params.initialInvestment) * 100;
    const scenarioMultiplier = selectedScenario === "Exponential Pump" || selectedScenario === "Parabolic" ? 2 
      : selectedScenario === "Volatile Growth" || selectedScenario === "Market Cycle" ? 0.5 : 1;
    
    if (leverageRisk > 0.5 / scenarioMultiplier) {
      recommendations.push({
        type: 'position',
        title: 'Projected Funding Cost Analysis',
        description: `With ${params.leverage}x leverage in ${selectedScenario.toLowerCase()} scenario, projected daily funding would be $${dailyFundingCost.toFixed(2)} (${leverageRisk.toFixed(2)}% of equity).`,
        severity: leverageRisk > 1 / scenarioMultiplier ? 'high' : 'medium',
        action: 'Consider adjusting leverage based on scenario characteristics'
      });
    }
  }

  // Liquidation Risk Analysis - adjusted for scenario volatility
  const liquidationDistance = ((liquidationDetails.liquidationPrice - params.currentPrice) / params.currentPrice) * 100;
  const scenarioVolatility = {
    "Exponential Pump": 2,
    "Volatile Growth": 2.5,
    "Sideways": 1,
    "Parabolic": 3,
    "Accumulation": 1.5,
    "Cascading Pump": 2,
    "Market Cycle": 2,
    "Linear": 1
  }[selectedScenario] || 1;

  if (Math.abs(liquidationDistance) < 15 * scenarioVolatility) {
    recommendations.push({
      type: 'risk',
      title: 'Scenario-Based Liquidation Risk',
      description: `In ${selectedScenario.toLowerCase()} scenario, a ${Math.abs(liquidationDistance).toFixed(2)}% move ${isLong ? 'down' : 'up'} would trigger liquidation. This scenario typically sees ${(scenarioVolatility * 10).toFixed(0)}% moves.`,
      severity: Math.abs(liquidationDistance) < 10 * scenarioVolatility ? 'high' : 'medium',
      action: 'Adjust position size or leverage based on scenario volatility'
    });
  }

  // Add spot comparison recommendations if not liquidated
  if (!fundingImpact.isLiquidated) {
    const spotComparison = calculateSpotComparison({
      initialInvestment: params.initialInvestment,
      currentPrice: params.currentPrice,
      targetPrice: params.targetPrice,
      leverage: params.leverage,
      fundingFees: fundingImpact.fundingFees,
      timeHorizon: params.timeHorizon,
      selectedScenario
    });

    recommendations.push(...getSpotComparisonRecommendations(spotComparison, {
      initialInvestment: params.initialInvestment,
      currentPrice: params.currentPrice,
      targetPrice: params.targetPrice,
      leverage: params.leverage,
      fundingFees: fundingImpact.fundingFees,
      timeHorizon: params.timeHorizon,
      selectedScenario
    }));
  }

  return recommendations;
};

const getIconForType = (type: RecommendationItem['type']) => {
  switch (type) {
    case 'risk':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'opportunity':
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    case 'safety':
      return <Shield className="h-5 w-5 text-yellow-500" />;
    case 'timing':
      return <Clock className="h-5 w-5 text-blue-500" />;
    case 'position':
      return <DollarSign className="h-5 w-5 text-purple-500" />;
    case 'target':
      return <Target className="h-5 w-5 text-orange-500" />;
    case 'critical':
      return <ArrowUpDown className="h-5 w-5 text-red-500" />;
  }
};

const getSeverityColor = (severity: RecommendationItem['severity']) => {
  switch (severity) {
    case 'low':
      return 'bg-blue-100 text-blue-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-red-100 text-red-800';
  }
};

export const RecommendationsContainer: React.FC<RecommendationsContainerProps> = ({
  params,
  currentPnL,
  liquidationRisk,
  effectiveMargin,
  selectedScenario
}) => {
  const recommendations = getRecommendations(params, currentPnL, liquidationRisk, effectiveMargin, selectedScenario);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Position Analysis</h3>
        <Badge variant="outline" className={recommendations.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}>
          {recommendations.length} {recommendations.length === 1 ? 'Action' : 'Actions'} Needed
        </Badge>
      </div>
      <Separator />
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            {getIconForType(rec.type)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{rec.title}</h4>
                <Badge className={getSeverityColor(rec.severity)}>
                  {rec.severity}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
              {rec.action && (
                <p className="text-sm font-medium text-primary mt-2">
                  💡 {rec.action}
                </p>
              )}
            </div>
          </div>
        ))}
        {recommendations.length === 0 && (
          <div className="text-center py-6">
            <Shield className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Position parameters look optimal! Monitor market conditions for any changes.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
