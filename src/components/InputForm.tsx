import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TokenSelector } from "./TokenSelector";
import { TokenInfo, fetchTokens, fetchTokenPrice, fetchFundingRate } from "@/utils/binanceApi";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, TrendingUp, Clock, DollarSign, Percent } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="relative overflow-hidden border-none shadow-2xl bg-gradient-to-br from-background/80 via-background/50 to-background/80 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />
        
        <Tabs defaultValue="position" className="p-6">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="position">Position Setup</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="position" className="space-y-6 mt-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <Label htmlFor="token" className="text-lg font-semibold">Trading Pair</Label>
                  </div>
                  {currentPrice && !isNaN(currentPrice) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="secondary" className="px-3 py-1 text-base transition-colors hover:bg-secondary/80">
                            ${Number(currentPrice).toFixed(8)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Current market price</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <TokenSelector
                  tokens={tokens || []}
                  selectedToken={params.selectedToken}
                  onTokenSelect={(token) => handleChange("selectedToken", token)}
                  isLoading={isLoadingTokens}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <Label htmlFor="investment" className="text-lg font-semibold">Investment</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="investment"
                      type="number"
                      value={params.initialInvestment || ''}
                      onChange={(e) => handleChange("initialInvestment", Number(e.target.value))}
                      min={1}
                      step={100}
                      className="text-lg pl-8"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Position Size:</span>
                    <Badge variant="outline" className="bg-primary/5">
                      ${((params.initialInvestment || 0) * (params.leverage || 1)).toFixed(2)}
                    </Badge>
                  </div>
                </motion.div>

                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-primary" />
                      <Label htmlFor="leverage" className="text-lg font-semibold">Leverage</Label>
                    </div>
                    <Badge variant="secondary" className="text-base">
                      {params.leverage || 1}x
                    </Badge>
                  </div>
                  <div className="pt-2">
                    <Slider
                      id="leverage"
                      value={[params.leverage || 1]}
                      onValueChange={([value]) => handleChange("leverage", value)}
                      min={1}
                      max={50}
                      step={1}
                      className="py-4"
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Min: 1x</span>
                    <span>Max: 50x</span>
                  </div>
                </motion.div>
              </div>

              <Separator className="my-6" />

              <div className="grid gap-6 md:grid-cols-2">
                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <Label htmlFor="targetPrice" className="text-lg font-semibold">Target Price</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="targetPrice"
                      type="number"
                      value={params.targetPrice || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          handleChange("targetPrice", currentPrice || 0);
                          return;
                        }
                        const parsed = Number(value);
                        if (!isNaN(parsed)) {
                          handleChange("targetPrice", parsed);
                        }
                      }}
                      min={0}
                      step="0.00000001"
                      className="text-lg pl-8"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  </div>
                  {currentPrice && !isNaN(currentPrice) && params.targetPrice && !isNaN(params.targetPrice) && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Expected Return:</span>
                      <Badge 
                        variant={((params.targetPrice - currentPrice) / currentPrice * 100) > 0 ? "success" : "destructive"}
                        className="animate-pulse"
                      >
                        {((params.targetPrice - currentPrice) / currentPrice * 100).toFixed(2)}%
                      </Badge>
                    </div>
                  )}
                </motion.div>

                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <Label htmlFor="timeHorizon" className="text-lg font-semibold">Time Horizon</Label>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="timeHorizon"
                        type="number"
                        value={params.timeHorizon || ''}
                        onChange={(e) => handleChange("timeHorizon", Number(e.target.value))}
                        min={1}
                        max={365}
                        step={1}
                        className="text-lg pr-20"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center">
                        <span className="px-3 text-muted-foreground">days</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Funding Events:</span>
                    <Badge variant="outline" className="bg-primary/5">
                      {((params.timeHorizon || 0) * 3).toFixed(0)}
                    </Badge>
                  </div>
                </motion.div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="mt-0">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-primary" />
                    <Label htmlFor="fundingRate" className="text-lg font-semibold">Funding Rate</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="fundingRate"
                      type="number"
                      value={params.fundingRate || ''}
                      onChange={(e) => handleChange("fundingRate", Number(e.target.value))}
                      min={-1}
                      max={1}
                      step={0.001}
                      disabled={!!fundingRate && !isNaN(fundingRate)}
                      className="text-lg pr-16"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <span className="px-3 text-muted-foreground">%</span>
                    </div>
                  </div>
                  {!isNaN(params.fundingRate) && (
                    <div className="grid gap-4 mt-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-card">
                        <span className="text-sm text-muted-foreground">Per 8 hours</span>
                        <Badge variant="outline" className={cn(
                          "bg-primary/5",
                          params.fundingRate > 0 ? "text-green-500" : params.fundingRate < 0 ? "text-red-500" : ""
                        )}>
                          {(params.fundingRate || 0).toFixed(3)}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-card">
                        <span className="text-sm text-muted-foreground">Daily Rate</span>
                        <Badge variant="outline" className={cn(
                          "bg-primary/5",
                          params.fundingRate > 0 ? "text-green-500" : params.fundingRate < 0 ? "text-red-500" : ""
                        )}>
                          {((params.fundingRate || 0) * 3).toFixed(3)}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-card">
                        <span className="text-sm text-muted-foreground">Annual Rate</span>
                        <Badge variant="outline" className={cn(
                          "bg-primary/5",
                          params.fundingRate > 0 ? "text-green-500" : params.fundingRate < 0 ? "text-red-500" : ""
                        )}>
                          {((params.fundingRate || 0) * 3 * 365).toFixed(2)}%
                        </Badge>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
};