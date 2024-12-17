const BINANCE_API_BASE = "https://api.binance.com/api/v3";

export interface TokenPrice {
  symbol: string;
  price: string;
}

export interface TokenInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

export const fetchTokens = async (): Promise<TokenInfo[]> => {
  const response = await fetch(`${BINANCE_API_BASE}/exchangeInfo`);
  const data = await response.json();
  return data.symbols
    .filter((symbol: any) => symbol.quoteAsset === "USDT")
    .map((symbol: any) => ({
      symbol: symbol.symbol,
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
    }));
};

export const fetchTokenPrice = async (symbol: string): Promise<number> => {
  const response = await fetch(`${BINANCE_API_BASE}/ticker/price?symbol=${symbol}`);
  const data = await response.json();
  return parseFloat(data.price);
};