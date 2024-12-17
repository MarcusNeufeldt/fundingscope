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
import { calculateFundingImpact, FundingRateImpact, calculateRawPnL } from "@/utils/fundingRateUtils";

interface ProfitLossChartProps {
  params: TradingParams;
}

interface ChartDataPoint {
  day: number;
  rawPnL: number;
  fundingFees: number;
  fundingRate: number;
  baseFundingRate: number;
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
      const modifiedFundingRate = scenario.name === "Linear" 
        ? baseFundingRate 
        : scenario.fundingModifier(day, baseFundingRate, priceChangePerc);

      const positionSize = initialInvestment * leverage;
      const fundingImpact = calculateFundingImpact(
        positionSize,
        modifiedFundingRate,
        totalFundingPeriods,
        leverage,
        initialInvestment,
        priceAtDay,
        true  // assuming long position for now
      );

      const rawPnL = calculateRawPnL(positionSize, currentPrice, priceAtDay);
      const totalPnL = rawPnL - Math.abs(fundingImpact.fundingFees);
      const pnlPercent = (totalPnL / initialInvestment) * 100;
      const effectiveMargin = initialInvestment + totalPnL;

      // If position is liquidated, return liquidation state
      if (fundingImpact.isLiquidated && fundingImpact.liquidationPeriod !== undefined) {
        const daysUntilLiquidation = Math.floor(fundingImpact.liquidationPeriod / fundingPeriodsPerDay);
        
        // If we're past liquidation point, return liquidation state
        if (day >= daysUntilLiquidation) {
          return {
            day,
            rawPnL: -initialInvestment,
            fundingFees: initialInvestment, // Maximum loss is initial margin
            fundingRate: 0,
            baseFundingRate: 0,
            totalPnL: -initialInvestment,
            price: priceAtDay,
            pnlPercent: -100,
            liquidationRisk: 100,
            effectiveMargin: 0,
            isLiquidated: true,
            marginWarning: 'danger'
          };
        }
      }

      // If not yet liquidated, calculate normal PnL
      const liquidationRisk = fundingImpact.liquidationRisk;

      // Calculate margin warning level
      const marginWarningLevel = (): 'safe' | 'warning' | 'danger' => {
        if (liquidationRisk > 80) return 'danger';
        if (liquidationRisk > 60) return 'warning';
        return 'safe';
      };

      return {
        day,
        rawPnL: Number(rawPnL.toFixed(2)),
        fundingFees: -Number(fundingImpact.fundingFees.toFixed(2)), // Negative because it's a cost
        fundingRate: modifiedFundingRate,
        baseFundingRate: baseFundingRate,
        totalPnL: Number(totalPnL.toFixed(2)),
        price: Number(priceAtDay.toFixed(8)),
        pnlPercent: Number(pnlPercent.toFixed(2)),
        liquidationRisk: Number(liquidationRisk.toFixed(2)),
        effectiveMargin: Number(effectiveMargin.toFixed(2)),
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
    const baseFundingRate = pnl.payload.baseFundingRate as number;

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
          <div className="text-muted-foreground">Current Funding Rate (8h):</div>
          <div className="font-medium">{fundingRate.toFixed(4)}%</div>
          {fundingRate !== baseFundingRate && (
            <>
              <div className="text-muted-foreground">Base Funding Rate (8h):</div>
              <div className="font-medium">{baseFundingRate.toFixed(4)}%</div>
            </>
          )}
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
            <Legend 
              verticalAlign="top"
              align="right"
              iconType="plainline"
              iconSize={20}
              wrapperStyle={{
                paddingLeft: '10px',
                paddingBottom: '20px',
                fontSize: '11px',
                opacity: 0.8
              }}
              formatter={(value) => (
                <span style={{ color: 'hsl(var(--foreground))', paddingLeft: '4px' }}>
                  {value}
                </span>
              )}
            />
            {/* Risk level backgrounds */}
            <ReferenceArea
              yAxisId="right"
              y1={0}
              y2={50}
              fill="#dcfce7"
              fillOpacity={0.3}
            />
            <ReferenceArea
              yAxisId="right"
              y1={50}
              y2={75}
              fill="#fef9c3"
              fillOpacity={0.3}
            />
            <ReferenceArea
              yAxisId="right"
              y1={75}
              y2={100}
              fill="#fee2e2"
              fillOpacity={0.3}
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
              name="Cumulative Funding Fees ($)"
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
      
      {/* Market Scenarios */}
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Market Scenarios:</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.name}
              className={`p-2 text-xs sm:text-sm rounded-lg border transition-colors
                ${activeScenario?.name === scenario.name 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'hover:bg-muted'
                }`}
              onClick={() => setActiveScenario(scenario)}
              onMouseEnter={() => setHoveredScenario(scenario)}
              onMouseLeave={() => setHoveredScenario(null)}
            >
              <div className="font-medium">{scenario.name}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                {scenario.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
});