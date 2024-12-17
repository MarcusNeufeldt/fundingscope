import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TokenInfo } from "@/utils/binanceApi";

interface TokenSelectorProps {
  tokens: TokenInfo[];
  selectedToken: string;
  onTokenSelect: (token: string) => void;
  isLoading?: boolean;
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  tokens,
  selectedToken,
  onTokenSelect,
  isLoading = false,
}) => {
  // Sort tokens alphabetically by baseAsset
  const sortedTokens = [...tokens].sort((a, b) => 
    a.baseAsset.localeCompare(b.baseAsset)
  );

  return (
    <div className="w-full">
      <Select
        value={selectedToken}
        onValueChange={onTokenSelect}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a token" />
        </SelectTrigger>
        <SelectContent className="bg-background border-border max-h-[300px] z-50">
          {sortedTokens.map((token) => (
            <SelectItem key={token.symbol} value={token.symbol}>
              {token.baseAsset}/USDT
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};