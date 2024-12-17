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
} from "recharts";
import { TradingParams } from "./InputForm";

interface ProfitLossChartProps {
  params: TradingParams;
}

export const ProfitLossChart: React.FC<ProfitLossChartProps> = ({ params }) => {
  const data = React.useMemo(() => {
    const { initialInvestment, leverage, targetPrice, timeHorizon, fundingRate } = params;
    const positionSize = initialInvestment * leverage;
    const currentPrice = 100; // Base price for percentage calculations
    const priceChange = ((targetPrice - currentPrice) / currentPrice) * 100; // Price change in percentage
    const dailyPriceChangePercent = priceChange / timeHorizon;
    
    return Array.from({ length: timeHorizon + 1 }, (_, day) => {
      const priceAtDay = currentPrice * (1 + (dailyPriceChangePercent * day) / 100);
      const pnlBeforeFunding = positionSize * ((priceAtDay - currentPrice) / currentPrice);
      const fundingFees = (positionSize * (fundingRate / 100) * day);
      const totalPnL = pnlBeforeFunding - fundingFees;
      
      return {
        day,
        pnl: totalPnL,
        fundingFees: -fundingFees,
      };
    });
  }, [params]);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Profit/Loss Over Time</h3>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              label={{ value: "Days", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              label={{
                value: "Profit/Loss (USD)",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
              labelFormatter={(label) => `Day ${label}`}
            />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="fundingFees"
              stroke="#EF4444"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};