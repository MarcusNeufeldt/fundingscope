import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface InputFormProps {
  onParamsChange: (params: TradingParams) => void;
}

export interface TradingParams {
  initialInvestment: number;
  leverage: number;
  targetPrice: number;
  timeHorizon: number;
  fundingRate: number;
}

export const InputForm: React.FC<InputFormProps> = ({ onParamsChange }) => {
  const [params, setParams] = React.useState<TradingParams>({
    initialInvestment: 1000,
    leverage: 2,
    targetPrice: 100,
    timeHorizon: 30,
    fundingRate: 0.01,
  });

  const handleChange = (field: keyof TradingParams, value: number) => {
    const newParams = { ...params, [field]: value };
    setParams(newParams);
    onParamsChange(newParams);
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-4">
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
            onChange={(e) => handleChange("targetPrice", Number(e.target.value))}
            min={0}
            step={1}
          />
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