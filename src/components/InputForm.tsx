import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TokenSelector } from "./TokenSelector";
import { TokenInfo, fetchTokens, fetchTokenPrice } from "@/utils/binanceApi";
import { useQuery } from "@tanstack/react-query";

interface InputFormProps {
  onParamsChange: (params: TradingParams) => void;
}

export interface TradingParams {
  initialInvestment: number;
  leverage: number;
  targetPrice: number;
  timeHorizon: number;
  fundingRate: number;
  selectedToken: string;
}

export const InputForm: React.FC<InputFormProps> = ({ onParamsChange }) => {
  const [params, setParams] = React.useState<TradingParams>({
    initialInvestment: 1000,
    leverage: 2,
    targetPrice: 100,
    timeHorizon: 30,
    fundingRate: 0.01,
    selectedToken: "BTCUSDT",
  });

  const { data: tokens, isLoading: isLoadingTokens } = useQuery({
    queryKey: ["tokens"],
    queryFn: fetchTokens,
  });

  const { data: currentPrice } = useQuery({
    queryKey: ["tokenPrice", params.selectedToken],
    queryFn: () => fetchTokenPrice(params.selectedToken),
    enabled: !!params.selectedToken,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleChange = (field: keyof TradingParams, value: number | string) => {
    const newParams = { ...params, [field]: value };
    setParams(newParams);
    onParamsChange(newParams);
  };

  // Only update target price when token changes, not on every price update
  React.useEffect(() => {
    if (currentPrice && params.selectedToken) {
      handleChange("targetPrice", parseFloat(currentPrice.toFixed(8)));
    }
  }, [params.selectedToken]); // Only depend on selectedToken, not currentPrice

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="token">Select Token</Label>
          <TokenSelector
            tokens={tokens || []}
            selectedToken={params.selectedToken}
            onTokenSelect={(token) => handleChange("selectedToken", token)}
            isLoading={isLoadingTokens}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="investment">Initial Investment (USD)</Label>
          <Input
            id="investment"
            type="number"
            value={params.initialInvestment}
            onChange={(e) => handleChange("initialInvestment", Number(e.target.value))}
            min={100}
            step={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="leverage">Leverage (x)</Label>
          <div className="pt-2">
            <Slider
              id="leverage"
              value={[params.leverage]}
              onValueChange={([value]) => handleChange("leverage", value)}
              min={1}
              max={10}
              step={1}
            />
          </div>
          <div className="text-sm text-muted-foreground text-right">
            {params.leverage}x
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetPrice">Target Price (USD)</Label>
          <Input
            id="targetPrice"
            type="number"
            value={params.targetPrice}
            onChange={(e) => handleChange("targetPrice", parseFloat(e.target.value))}
            min={0}
            step="any"
          />
          {currentPrice && (
            <div className="text-sm text-muted-foreground">
              Current price: ${currentPrice.toFixed(8)}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeHorizon">Time Horizon (Days)</Label>
          <Input
            id="timeHorizon"
            type="number"
            value={params.timeHorizon}
            onChange={(e) => handleChange("timeHorizon", Number(e.target.value))}
            min={1}
            max={365}
            step={1}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fundingRate">Daily Funding Rate (%)</Label>
          <Input
            id="fundingRate"
            type="number"
            value={params.fundingRate}
            onChange={(e) => handleChange("fundingRate", Number(e.target.value))}
            min={-1}
            max={1}
            step={0.001}
          />
        </div>
      </div>
    </Card>
  );
};