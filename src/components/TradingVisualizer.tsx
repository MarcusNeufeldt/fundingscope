import React from "react";
import { ProfitLossChart } from "./ProfitLossChart";
import { InputForm, TradingParams } from "./InputForm";
import { Card } from "./ui/card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export const TradingVisualizer: React.FC = () => {
  const [params, setParams] = React.useState<TradingParams>({
    initialInvestment: 1000,
    leverage: 2,
    targetPrice: 100,
    timeHorizon: 365,
    fundingRate: 0.0003,
    currentPrice: 50,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <div className="text-center mb-12">
          <h1 className="text-xl sm:text-2xl font-bold text-primary mb-4">
            Leveraged Trading Visualizer
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Analyze the impact of funding fees on your leveraged positions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="sticky top-4">
              <InputForm params={params} onParamsChange={setParams} />
            </div>
          </div>
          <div className="lg:col-span-2 order-1 lg:order-2">
            <ProfitLossChart params={params} />
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
};