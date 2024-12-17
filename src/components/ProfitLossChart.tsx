import React from "react";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea
} from "recharts";
import { TradingParams } from "./InputForm";
import { calculateFundingImpact, FundingRateImpact } from "@/utils/fundingRateUtils";

interface ProfitLossChartProps {
  params: TradingParams;
}

interface ChartDataPoint {
  day: number;
  rawPnL: number;
  fundingFees: number;
  fundingRate: number;
  totalPnL: number;
  price: number;
  pnlPercent: number;
  liquidationRisk: number;
  effectiveMargin: number;
  isLiquidated: boolean;
  marginWarning?: 'safe' | 'warning' | 'danger';
}

interface PriceScenario {
  name: string;
  description: string;
  priceModifier: (day: number, baseReturn: number) => number;
  fundingModifier: (day: number, baseFunding: number, priceChange: number) => number;
}

const scenarios: PriceScenario[] = [
  {
    name: "Linear",
    description: "Basic scenario with steady growth. Price increases linearly, funding rate remains constant. Good baseline for comparison.",
    priceModifier: (day, baseReturn) => baseReturn * day,
    fundingModifier: (_, baseFunding) => baseFunding,
  },
  {
    name: "Exponential Pump",
    description: "Simulates a strong uptrend. Price growth accelerates while funding rates spike due to market enthusiasm. Common in alt-season rallies.",
    priceModifier: (day, baseReturn) => baseReturn * Math.pow(day, 1.5) / Math.pow(day, 0.5),
    fundingModifier: (day, baseFunding, priceChange) => 
      baseFunding * (1 + Math.max(0, priceChange) * 2),
  },
  {
    name: "Volatile Growth",
    description: "Realistic market behavior with pullbacks. Price grows but with periodic corrections. Funding fluctuates based on market sentiment.",
    priceModifier: (day, baseReturn) => 
      baseReturn * day * (1 + 0.3 * Math.sin(day / 10)),
    fundingModifier: (day, baseFunding) => 
      baseFunding * (1 + 0.5 * Math.sin(day / 5)),
  },
  {
    name: "Sideways",
    description: "Most common scenario. Price oscillates around a mean with small movements. Funding stays relatively stable but eats into margin over time.",
    priceModifier: (day, baseReturn) => {
      const oscillation = Math.sin(day / 15) * 0.1; // 10% oscillation
      return baseReturn * day * 0.1 + oscillation; // Mostly sideways with slight drift
    },
    fundingModifier: (day, baseFunding) => 
      baseFunding * (1 + 0.1 * Math.sin(day / 10)), // Small funding fluctuations
  },
  {
    name: "Parabolic",
    description: "Classic bubble pattern. Slow start followed by explosive growth. Funding rates become extreme as FOMO kicks in. High risk of liquidation.",
    priceModifier: (day, baseReturn) => 
      baseReturn * Math.pow(day / 100, 2),
    fundingModifier: (day, baseFunding, priceChange) => 
      baseFunding * (1 + Math.pow(day / 100, 1.5)),
  },
  {
    name: "Accumulation",
    description: "Sideways with slight upward bias, then strong breakout. Funding starts low but increases sharply after breakout. Common in early trends.",
    priceModifier: (day, baseReturn) => {
      const breakout = day > 50 ? Math.pow((day - 50) / 30, 2) : 0;
      return baseReturn * day * (0.2 + breakout);
    },
    fundingModifier: (day, baseFunding) => 
      baseFunding * (day > 50 ? 1 + Math.pow((day - 50) / 30, 1.5) : 0.5),
  },
  {
    name: "Cascading Pump",
    description: "Multiple wave pattern with increasing amplitude. Funding rates surge during each wave. Simulates coordinated buying pressure.",
    priceModifier: (day, baseReturn) => {
      const wave1 = Math.sin(day / 20) * Math.min(1, day / 30);
      const wave2 = Math.sin(day / 40) * Math.min(1, day / 60) * 2;
      const wave3 = Math.sin(day / 80) * Math.min(1, day / 90) * 4;
      return baseReturn * day * (1 + wave1 + wave2 + wave3);
    },
    fundingModifier: (day, baseFunding, priceChange) => 
      baseFunding * (1 + Math.abs(Math.sin(day / 20)) + Math.abs(priceChange)),
  },
  {
    name: "Market Cycle",
    description: "Complete market cycle with accumulation, markup, distribution, and decline phases. Funding follows market phases. Tests timing skills.",
    priceModifier: (day, baseReturn) => {
      const phase = (day % 100) / 100;
      if (phase < 0.3) return baseReturn * day * 0.5;
      if (phase < 0.6) return baseReturn * day * (1 + Math.pow(phase, 2));
      if (phase < 0.8) return baseReturn * day * (1.5 - Math.pow(phase - 0.6, 2));
      return baseReturn * day * (1 - Math.pow(phase - 0.8, 2));
    },
    fundingModifier: (day, baseFunding, priceChange) => {
      const phase = (day % 100) / 100;
      return baseFunding * (1 + Math.abs(priceChange) * (phase < 0.6 ? 2 : 0.5));
    },
  }
];

export const ProfitLossChart: React.FC<ProfitLossChartProps> = React.memo(({ params }) => {
  const [activeScenario, setActiveScenario] = React.useState<PriceScenario | null>(null);
  const [hoveredScenario, setHoveredScenario] = React.useState<PriceScenario | null>(null);

  const data = React.useMemo(() => {
    const { initialInvestment, leverage, targetPrice, timeHorizon, fundingRate, currentPrice } = params;
    const scenario = hoveredScenario || activeScenario || scenarios[0];
    
    // Base daily return (linear case)
    const expectedReturnPerc = ((targetPrice - currentPrice) / currentPrice);
    const baseDailyReturnPerc = expectedReturnPerc / timeHorizon;
    
    // Base funding rate (per 8-hour period)
    const baseFundingRate = fundingRate;

    return Array.from({ length: timeHorizon + 1 }, (_, day) => {
      // Apply scenario modifiers
      const modifiedDailyReturn = scenario.priceModifier(day, baseDailyReturnPerc);
      const priceAtDay = currentPrice * (1 + modifiedDailyReturn);
      const priceChangePerc = (priceAtDay - currentPrice) / currentPrice;
      
      const fundingPeriodsPerDay = 3;
      const totalFundingPeriods = day * fundingPeriodsPerDay;
      
      // Modified funding rate based on scenario
      const modifiedFundingRate = scenario.fundingModifier(day, baseFundingRate, priceChangePerc);

      const positionSize = initialInvestment * leverage;
      const rawPnL = positionSize * priceChangePerc;
      const fundingImpact = calculateFundingImpact(
        positionSize,
        modifiedFundingRate,
        totalFundingPeriods,
        leverage,
        initialInvestment,
        priceAtDay,
        true  // assuming long position for now
      );

      // If position is liquidated, calculate days until liquidation
      if (fundingImpact.isLiquidated && fundingImpact.liquidationPeriod !== undefined) {
        const daysUntilLiquidation = Math.floor(fundingImpact.liquidationPeriod / fundingPeriodsPerDay);
        
        // If we're past liquidation point, return liquidation state
        if (day >= daysUntilLiquidation) {
          return {
            day,
            rawPnL: -initialInvestment,
            fundingFees: initialInvestment, // Maximum loss is initial margin
            fundingRate: 0,
            totalPnL: -initialInvestment,
            price: priceAtDay,
            pnlPercent: -100,
            liquidationRisk: 100,
            effectiveMargin: 0,
            isLiquidated: true
          };
        }
      }

      // If not yet liquidated, calculate normal PnL
      const effectivePositionSize = positionSize * (fundingImpact.effectiveMargin / initialInvestment);
      const adjustedPriceChangePerc = (priceAtDay - currentPrice) / currentPrice;
      const totalPnL = effectivePositionSize * adjustedPriceChangePerc - fundingImpact.fundingFees;
      const pnlPercent = (totalPnL / initialInvestment * 100);

      // Calculate margin warning level
      const marginWarningLevel = (): 'safe' | 'warning' | 'danger' => {
        if (fundingImpact.liquidationRisk > 80) return 'danger';
        if (fundingImpact.liquidationRisk > 60) return 'warning';
        return 'safe';
      };

      return {
        day,
        rawPnL: Number(rawPnL.toFixed(2)),
        fundingFees: Number(fundingImpact.fundingFees.toFixed(2)),
        fundingRate: Number(modifiedFundingRate.toFixed(8)),
        totalPnL: Number(totalPnL.toFixed(2)),
        price: Number(priceAtDay.toFixed(8)),
        pnlPercent: Number(pnlPercent.toFixed(2)),
        liquidationRisk: Number(fundingImpact.liquidationRisk.toFixed(2)),
        effectiveMargin: Number(fundingImpact.effectiveMargin.toFixed(2)),
        isLiquidated: false,
        marginWarning: marginWarningLevel()
      };
    }).filter(d => d.day % Math.max(1, Math.floor(timeHorizon / 10)) === 0 || d.day === timeHorizon);
  }, [params, activeScenario, hoveredScenario]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const [pnl, funding, risk] = payload;
    const day = pnl.payload.day;
    const price = pnl.payload.price;
    const rawPnL = pnl.value as number;
    const fundingImpact = funding.value as number;
    const riskLevel = risk.value as number;
    const fundingRate = pnl.payload.fundingRate as number;

    const getStatusColor = (risk: number) => {
      if (risk >= 90) return 'text-red-500';
      if (risk >= 75) return 'text-orange-500';
      if (risk >= 50) return 'text-yellow-500';
      return 'text-green-500';
    };

    const getStatusText = (risk: number) => {
      if (risk >= 90) return 'Critical Risk';
      if (risk >= 75) return 'High Risk';
      if (risk >= 50) return 'Medium Risk';
      return 'Low Risk';
    };

    return (
      <div className="bg-popover/95 backdrop-blur-sm p-2 sm:p-3 rounded-lg border shadow-lg text-[10px] sm:text-xs space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-muted-foreground">Day:</div>
          <div className="font-medium">{day}</div>
          <div className="text-muted-foreground">Price:</div>
          <div className="font-medium">${price.toFixed(4)}</div>
          <div className="text-muted-foreground">Raw PnL:</div>
          <div className="font-medium">${rawPnL.toLocaleString()}</div>
          <div className="text-muted-foreground">Funding Impact:</div>
          <div className="font-medium text-indigo-500">-${Math.abs(fundingImpact).toLocaleString()}</div>
          <div className="text-muted-foreground">Net PnL:</div>
          <div className="font-medium">${(rawPnL - Math.abs(fundingImpact)).toLocaleString()}</div>
          <div className="text-muted-foreground">APR:</div>
          <div className="font-medium">{(fundingRate * 365 * 100).toFixed(2)}%</div>
        </div>
        <div className="pt-1 border-t space-y-1">
          <div className={`font-medium ${getStatusColor(riskLevel)}`}>
            {getStatusText(riskLevel)} ({riskLevel.toFixed(1)}%)
          </div>
          {riskLevel >= 75 && (
            <div className="text-muted-foreground">
              ⚠️ Consider reducing leverage or taking profit
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-1 sm:space-y-2">
        <h3 className="text-base sm:text-lg font-semibold">Profit/Loss Over Time</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Simulating long position with positive funding rates only. Negative funding would reduce costs and extend position viability.
        </p>
      </div>
      <div className="h-[300px] sm:h-[400px] mt-3 sm:mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 5,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, 'auto']}
              tickFormatter={(day) => `${day}d`}
              fontSize={10}
              tickMargin={8}
              minTickGap={30}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => `$${Math.abs(value).toLocaleString()}`}
              fontSize={10}
              tickMargin={8}
              width={60}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
              fontSize={10}
              tickMargin={8}
              width={40}
            />
            <Tooltip
              content={CustomTooltip}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="totalPnL"
              stroke="rgb(34,197,94)"
              strokeWidth={2}
              dot={false}
              name="Total PnL ($)"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="fundingFees"
              stroke="rgb(99,102,241)"
              strokeWidth={2}
              dot={false}
              name="Funding Fees ($)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="liquidationRisk"
              stroke="rgb(239,68,68)"
              strokeWidth={2}
              dot={false}
              name="Liquidation Risk (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Scenario buttons */}
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Market Scenarios:</h4>
          <span className="text-xs text-muted-foreground">Hover to preview, click to select</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {scenarios.map((scenario) => {
            const isActive = activeScenario?.name === scenario.name;
            const isHovered = hoveredScenario?.name === scenario.name;
            const showTooltip = isHovered || isActive;
            
            return (
              <div key={scenario.name} className="relative">
                <button
                  className={`w-full px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                      : 'bg-secondary hover:bg-secondary/80 hover:scale-[1.02]'
                  }`}
                  onClick={() => setActiveScenario(isActive ? null : scenario)}
                  onMouseEnter={() => setHoveredScenario(scenario)}
                  onMouseLeave={() => setHoveredScenario(null)}
                >
                  <div className="font-medium truncate">{scenario.name}</div>
                  <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 opacity-80 line-clamp-1">
                    {scenario.description.split('.')[0]}
                  </div>
                </button>
                
                {showTooltip && (
                  <div className="absolute z-10 left-0 right-0 mt-2 p-2 sm:p-3 bg-popover/95 backdrop-blur-sm text-popover-foreground rounded-lg shadow-xl border text-[10px] sm:text-xs space-y-1.5 sm:space-y-2">
                    <div className="font-medium">{scenario.name}</div>
                    <div className="space-y-1.5">
                      {scenario.description.split('.').filter(Boolean).map((sentence, idx) => (
                        <p key={idx} className="text-muted-foreground">
                          • {sentence.trim()}
                        </p>
                      ))}
                    </div>
                    {isHovered && !isActive && (
                      <div className="pt-1.5 text-[10px] text-muted-foreground/80">
                        Click to activate this scenario
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            Total PnL
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            Funding Fees
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            Liquidation Risk
          </div>
        </div>
      </div>
    </Card>
  );
});