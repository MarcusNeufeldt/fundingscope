import React from "react";
import { Card } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TradingParams } from "./InputForm";

interface FundingFeeChartProps {
  params: TradingParams;
}

export const FundingFeeChart: React.FC<FundingFeeChartProps> = ({ params }) => {
  const data = React.useMemo(() => {
    const { initialInvestment, leverage, timeHorizon, fundingRate } = params;
    const positionSize = initialInvestment * leverage;
    
    return Array.from({ length: timeHorizon + 1 }, (_, day) => {
      const cumulativeFees = (positionSize * fundingRate * day) / 100;
      return {
        day,
        fees: cumulativeFees,
      };
    });
  }, [params]);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Cumulative Funding Fees</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              label={{ value: "Days", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              label={{
                value: "Cumulative Fees (USD)",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Cumulative Fees"]}
              labelFormatter={(label) => `Day ${label}`}
            />
            <Area
              type="monotone"
              dataKey="fees"
              stroke="#EF4444"
              fill="#FEE2E2"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};