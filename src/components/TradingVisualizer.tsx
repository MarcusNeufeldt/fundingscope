import React from "react";
import { ProfitLossChart } from "./ProfitLossChart";
import { InputForm, TradingParams } from "./InputForm";
import { Card } from "./ui/card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HowToUseSheet } from "./HowToUseSheet";

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
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">
              FundingScope Analysis Tool
            </h1>
            <HowToUseSheet />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Make informed decisions about leverage vs. spot trading by analyzing funding fees impact, 
            liquidation risks, and position profitability across different market scenarios
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