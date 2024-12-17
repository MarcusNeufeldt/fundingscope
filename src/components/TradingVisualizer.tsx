import React from "react";
import { InputForm, TradingParams } from "./InputForm";
import { ProfitLossChart } from "./ProfitLossChart";
import { FundingFeeChart } from "./FundingFeeChart";
import { SensitivityAnalysis } from "./SensitivityAnalysis";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export const TradingVisualizer: React.FC = () => {
  const [params, setParams] = React.useState<TradingParams>({
    initialInvestment: 1000,
    leverage: 2,
    targetPrice: 100,
    timeHorizon: 30,
    fundingRate: 0.01,
    selectedToken: "BTCUSDT",
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className="container mx-auto py-8 space-y-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Leveraged Trading Visualizer
          </h1>
          <p className="text-lg text-muted-foreground">
            Analyze the impact of funding fees on your leveraged positions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <InputForm onParamsChange={setParams} />
          </div>
          <div className="lg:col-span-2">
            <div className="space-y-8">
              <ProfitLossChart params={params} />
              <FundingFeeChart params={params} />
              <SensitivityAnalysis params={params} />
            </div>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
};