// Type definitions for trading scenarios

export type TradingScenario = 
  | 'Linear'
  | 'Exponential Pump'
  | 'Volatile Growth'
  | 'Sideways'
  | 'Parabolic'
  | 'Accumulation'
  | 'Cascading Pump'
  | 'Market Cycle';

export interface ScenarioModifiers {
  priceModifier: (day: number, baseReturn: number) => number;
  fundingModifier: (day: number, baseFunding: number, priceChange?: number) => number;
}

export interface TradingScenarios {
  [key: string]: ScenarioModifiers;
}