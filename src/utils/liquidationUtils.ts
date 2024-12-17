export interface LiquidationDetails {
    liquidationPrice: number;
    liquidationDistance: number;
    liquidationDistancePercent: number;
    initialMarginRequired: number;
    maintenanceMarginRequired: number;
}

/**
 * Calculate liquidation details for a position
 * @param currentPrice Current asset price
 * @param leverage Leverage ratio (e.g., 10 for 10x)
 * @param positionSize Total position size in USD
 * @param isLong Whether the position is long (true) or short (false)
 * @returns Liquidation details including price and distances
 */
export const calculateLiquidationDetails = (
    currentPrice: number,
    leverage: number,
    positionSize: number,
    isLong: boolean = true
): LiquidationDetails => {
    console.log('\n=== Liquidation Price Calculation ===');
    
    // Calculate liquidation distance percentage
    const liquidationDistancePercent = 100 / leverage;
    console.log(`Liquidation Distance %: ${liquidationDistancePercent.toFixed(4)}%
    Calculation: 100 / Leverage (${leverage})`);

    // Calculate liquidation distance in price terms
    const liquidationDistance = currentPrice * (liquidationDistancePercent / 100);
    console.log(`Liquidation Distance in Price: $${liquidationDistance.toFixed(4)}
    Calculation: Current Price ($${currentPrice}) × (${liquidationDistancePercent.toFixed(4)}% / 100)`);

    // Calculate liquidation price based on position direction
    const liquidationPrice = isLong
        ? currentPrice - liquidationDistance
        : currentPrice + liquidationDistance;
    console.log(`Liquidation Price: $${liquidationPrice.toFixed(4)}
    Calculation: ${isLong ? 'Current Price - Distance' : 'Current Price + Distance'}
    $${currentPrice} ${isLong ? '-' : '+'} $${liquidationDistance.toFixed(4)}`);

    // Calculate margin requirements
    const initialMarginRequired = positionSize / leverage;
    // No maintenance margin required for 1x leverage
    const maintenanceMarginRequired = leverage === 1 ? 0 : initialMarginRequired * 0.5;
    console.log(`Initial Margin Required: $${initialMarginRequired.toFixed(4)}
    Calculation: Position Size ($${positionSize}) / Leverage (${leverage})
    Maintenance Margin Required: $${maintenanceMarginRequired.toFixed(4)}
    Calculation: ${leverage === 1 ? 'No maintenance margin for 1x leverage' : `Initial Margin ($${initialMarginRequired.toFixed(4)}) × 0.5`}`);

    console.log('=== End Liquidation Calculation ===\n');

    return {
        liquidationPrice,
        liquidationDistance,
        liquidationDistancePercent,
        initialMarginRequired,
        maintenanceMarginRequired
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
