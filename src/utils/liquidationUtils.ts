export interface LiquidationDetails {
    liquidationPrice: number;
    liquidationDistance: number;
    liquidationDistancePercent: number;
    initialMarginRequired: number;
    maintenanceMarginRequired: number;
    adjustedLiquidationDistance?: number;
    realTimeMargin?: number;
}

/**
 * Calculate liquidation details for a position
 * @param currentPrice Current asset price
 * @param leverage Leverage ratio (e.g., 10 for 10x)
 * @param positionSize Total position size in USD
 * @param isLong Whether the position is long (true) or short (false)
 * @param unrealizedPnL Current unrealized PnL (optional)
 * @param accumulatedFundingFees Total accumulated funding fees (optional)
 * @returns Liquidation details including price and distances
 */
export const calculateLiquidationDetails = (
    currentPrice: number,
    leverage: number,
    positionSize: number,
    isLong: boolean = true,
    unrealizedPnL: number = 0,
    accumulatedFundingFees: number = 0
): LiquidationDetails => {
    console.log('\n=== Liquidation Price Calculation ===');
    
    // Calculate initial values
    const liquidationDistancePercent = 100 / leverage;
    const initialMarginRequired = positionSize / leverage;
    const maintenanceMarginRequired = leverage === 1 ? 0 : initialMarginRequired * 0.5;
    
    // Calculate real-time margin including PnL and funding
    const realTimeMargin = initialMarginRequired + unrealizedPnL - accumulatedFundingFees;
    
    // Calculate base liquidation distance
    const baseLiquidationDistance = currentPrice * (liquidationDistancePercent / 100);
    
    // Adjust liquidation distance based on PnL
    const pnlAdjustmentFactor = 1 + (unrealizedPnL / positionSize);
    const adjustedLiquidationDistance = baseLiquidationDistance * pnlAdjustmentFactor;
    
    // Calculate final liquidation price considering position direction
    const liquidationPrice = isLong
        ? currentPrice - adjustedLiquidationDistance
        : currentPrice + adjustedLiquidationDistance;

    console.log(`Real-time Margin: $${realTimeMargin.toFixed(4)}
    Base Distance: $${baseLiquidationDistance.toFixed(4)}
    PnL Adjusted Distance: $${adjustedLiquidationDistance.toFixed(4)}
    Final Liquidation Price: $${liquidationPrice.toFixed(4)}`);

    return {
        liquidationPrice,
        liquidationDistance: adjustedLiquidationDistance,
        liquidationDistancePercent,
        initialMarginRequired,
        maintenanceMarginRequired,
        adjustedLiquidationDistance,
        realTimeMargin
    };
};

/**
 * Check if a position would be liquidated at a given price
 * @param currentPrice Current market price
 * @param entryPrice Price at which the position was opened
 * @param leverage Leverage ratio
 * @param isLong Position direction
 * @returns Whether the position would be liquidated
 */
export const wouldBeLiquidated = (
    currentPrice: number,
    entryPrice: number,
    leverage: number,
    isLong: boolean = true
): boolean => {
    const { liquidationPrice } = calculateLiquidationDetails(entryPrice, leverage, entryPrice * leverage, isLong);
    
    if (isLong) {
        return currentPrice <= liquidationPrice;
    } else {
        return currentPrice >= liquidationPrice;
    }
};
