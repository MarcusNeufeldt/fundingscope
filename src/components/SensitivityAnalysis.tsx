import React from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TradingParams } from "./InputForm";

interface SensitivityAnalysisProps {
  params: TradingParams;
}

export const SensitivityAnalysis: React.FC<SensitivityAnalysisProps> = ({ params }) => {
  const calculatePnL = (modifiedParams: TradingParams) => {
    const { initialInvestment, leverage, targetPrice, timeHorizon, fundingRate } = modifiedParams;
    const positionSize = initialInvestment * leverage;
    const pnlBeforeFunding = positionSize * ((targetPrice - 100) / 100);
    const fundingFees = (positionSize * fundingRate * timeHorizon) / 100;
    return pnlBeforeFunding - fundingFees;
  };

  const scenarios = React.useMemo(() => {
    const baselinePnL = calculatePnL(params);
    
    return [
      {
        scenario: "Baseline",
        leverage: params.leverage,
        fundingRate: params.fundingRate,
        pnl: baselinePnL,
      },
      {
        scenario: "Higher Leverage",
        leverage: params.leverage + 2,
        fundingRate: params.fundingRate,
        pnl: calculatePnL({ ...params, leverage: params.leverage + 2 }),
      },
      {
        scenario: "Lower Leverage",
        leverage: Math.max(1, params.leverage - 2),
        fundingRate: params.fundingRate,
        pnl: calculatePnL({ ...params, leverage: Math.max(1, params.leverage - 2) }),
      },
      {
        scenario: "Higher Funding Rate",
        leverage: params.leverage,
        fundingRate: params.fundingRate + 0.01,
        pnl: calculatePnL({ ...params, fundingRate: params.fundingRate + 0.01 }),
      },
      {
        scenario: "Lower Funding Rate",
        leverage: params.leverage,
        fundingRate: params.fundingRate - 0.01,
        pnl: calculatePnL({ ...params, fundingRate: params.fundingRate - 0.01 }),
      },
    ];
  }, [params]);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Sensitivity Analysis</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scenario</TableHead>
            <TableHead>Leverage</TableHead>
            <TableHead>Funding Rate (%)</TableHead>
            <TableHead>Expected P/L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scenarios.map((scenario) => (
            <TableRow key={scenario.scenario}>
              <TableCell>{scenario.scenario}</TableCell>
              <TableCell>{scenario.leverage}x</TableCell>
              <TableCell>{(scenario.fundingRate * 100).toFixed(3)}%</TableCell>
              <TableCell className={scenario.pnl >= 0 ? "text-profit" : "text-loss"}>
                ${scenario.pnl.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};