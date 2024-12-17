import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TokenSelector } from "./TokenSelector";
import { TokenInfo, fetchTokens, fetchTokenPrice, fetchFundingRate } from "@/utils/binanceApi";
import { useQuery } from "@tanstack/react-query";

interface InputFormProps {
  onParamsChange: (params: TradingParams) => void;
}

export interface TradingParams {
  initialInvestment: number;
  leverage: number;
  targetPrice: number;
  timeHorizon: number;
  fundingRate: number;  // This will now be per 8-hour rate
  selectedToken: string;
  currentPrice: number;
}

export const InputForm: React.FC<InputFormProps> = ({ onParamsChange }) => {
  const [params, setParams] = React.useState<TradingParams>({
    initialInvestment: 1000,
    leverage: 2,
    targetPrice: 0,
    timeHorizon: 30,
    fundingRate: 0.01,  // Default 0.01% per 8 hours
    selectedToken: "BTCUSDT",
    currentPrice: 0,
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

  const { data: fundingRate } = useQuery({
    queryKey: ["fundingRate", params.selectedToken],
    queryFn: () => fetchFundingRate(params.selectedToken),
    enabled: !!params.selectedToken,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleChange = (field: keyof TradingParams, value: number | string) => {
    if (typeof value === 'number' && isNaN(value)) {
      return; // Don't update if value is NaN
    }
    const newParams = { ...params, [field]: value };
    setParams(newParams);
    onParamsChange(newParams);
  };

  React.useEffect(() => {
    if (currentPrice) {
      const newParams = { 
        ...params, 
        currentPrice,
        targetPrice: params.targetPrice === 0 || isNaN(params.targetPrice) ? currentPrice : params.targetPrice 
      };
      setParams(newParams);
      onParamsChange(newParams);
    }
  }, [currentPrice]);

  React.useEffect(() => {
    if (fundingRate !== undefined && !isNaN(fundingRate)) {
      const newParams = {
        ...params,
        fundingRate: fundingRate
      };
      setParams(newParams);
      onParamsChange(newParams);
    }
  }, [fundingRate]);

  // Update target price and reset funding rate when token changes
  React.useEffect(() => {
    // Reset target price immediately when token changes
    const newParams = {
      ...params,
      targetPrice: 0, // Reset to ensure it updates with new current price
      fundingRate: 0.01 // Reset to default until new rate is fetched
    };
    setParams(newParams);
    onParamsChange(newParams);

    // Update with current price when available
    if (currentPrice) {
      const updatedParams = {
        ...newParams,
        currentPrice,
        targetPrice: currentPrice,
      };
      setParams(updatedParams);
      onParamsChange(updatedParams);
    }
  }, [params.selectedToken]);

  // Update target price when current price changes and target is not set
  React.useEffect(() => {
    if (currentPrice && (params.targetPrice === 0 || isNaN(params.targetPrice))) {
      const newParams = {
        ...params,
        currentPrice,
        targetPrice: currentPrice
      };
      setParams(newParams);
      onParamsChange(newParams);
    }
  }, [currentPrice]);

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
          {currentPrice && !isNaN(currentPrice) && (
            <div className="text-sm text-muted-foreground mt-2">
              Current price: ${Number(currentPrice).toFixed(8)}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="investment">Initial Investment (USD)</Label>
          <Input
            id="investment"
            type="number"
            value={params.initialInvestment || ''}
            onChange={(e) => handleChange("initialInvestment", Number(e.target.value))}
            min={1}
            step={100}
          />
          <div className="text-sm text-muted-foreground">
            Position Size: ${((params.initialInvestment || 0) * (params.leverage || 1)).toFixed(2)}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="leverage">Leverage (x)</Label>
          <div className="pt-2">
            <Slider
              id="leverage"
              value={[params.leverage || 1]}
              onValueChange={([value]) => handleChange("leverage", value)}
              min={1}
              max={50}
              step={1}
            />
          </div>
          <div className="text-sm text-muted-foreground text-right">
            {params.leverage || 1}x
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetPrice">Target Price (USD)</Label>
          <Input
            id="targetPrice"
            type="number"
            value={params.targetPrice || ''}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty input
              if (value === '') {
                handleChange("targetPrice", currentPrice || 0);
                return;
              }
              // Parse with high precision
              const parsed = Number(value);
              if (!isNaN(parsed)) {
                handleChange("targetPrice", parsed);
              }
            }}
            min={0}
            step="0.00000001"
          />
          {currentPrice && !isNaN(currentPrice) && params.targetPrice && !isNaN(params.targetPrice) && (
            <div className="text-sm text-muted-foreground">
              Expected Return: {((params.targetPrice - currentPrice) / currentPrice * 100).toFixed(2)}%
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeHorizon">Time Horizon (Days)</Label>
          <Input
            id="timeHorizon"
            type="number"
            value={params.timeHorizon || ''}
            onChange={(e) => handleChange("timeHorizon", Number(e.target.value))}
            min={1}
            max={365}
            step={1}
          />
          <div className="text-sm text-muted-foreground">
            Funding Payments: {((params.timeHorizon || 0) * 3).toFixed(0)} times
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fundingRate">Current Funding Rate (% per 8 hours)</Label>
          <Input
            id="fundingRate"
            type="number"
            value={params.fundingRate || ''}
            onChange={(e) => handleChange("fundingRate", Number(e.target.value))}
            min={-1}
            max={1}
            step={0.001}
            disabled={!!fundingRate && !isNaN(fundingRate)}
          />
          {!isNaN(params.fundingRate) && (
            <div className="text-sm text-muted-foreground">
              Daily Rate: {((params.fundingRate || 0) * 3).toFixed(3)}% | 
              Annual Rate: {((params.fundingRate || 0) * 3 * 365).toFixed(2)}%
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};