const BINANCE_API_BASE = "https://api.binance.com/api/v3";
const BINANCE_FUTURES_API = "https://fapi.binance.com/fapi/v1";

export interface TokenPrice {
  symbol: string;
  price: string;
}

export interface TokenInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface FundingRate {
  symbol: string;
  fundingRate: number;
  fundingTime: number;
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

export const fetchFundingRate = async (symbol: string): Promise<number> => {
  try {
    // Convert spot symbol to futures symbol (e.g., BTCUSDT -> BTCUSDT)
    const futuresSymbol = symbol;  // No need to modify, use as is
    const response = await fetch(`${BINANCE_FUTURES_API}/premiumIndex?symbol=${futuresSymbol}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch funding rate: ${response.statusText}`);
    }
    const data = await response.json();
    // Convert to percentage and return
    return parseFloat(data.lastFundingRate) * 100;
  } catch (error) {
    console.error('Error fetching funding rate:', error);
    return 0.01; // Default to 0.01% if unable to fetch
  }
};