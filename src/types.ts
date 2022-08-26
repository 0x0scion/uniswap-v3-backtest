export interface RebalanceTestOptions {
  positionRange: number
  rebalanceThreshold: number
  days?: number
  protocol?: number
  priceToken?: number
  period?: 'hourly' | 'daily'
  startTimestamp?: number
  endTimestamp?: number
}

export interface TestOptions {
  days?: number
  protocol?: number
  priceToken?: number
  period?: 'hourly' | 'daily'
  startTimestamp?: number
  endTimestamp?: number
  rebalanceThreshold?: number
  positionRange?: number
}

export interface BacktestState {
  balance: number
  il: number
  fees: number
  apr: number
  results: any
  poolData: any
  startBalance: number
  lastRebalance?: number
}
