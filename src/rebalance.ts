import { RebalanceTestOptions, BacktestState } from './types'
import { uniswapStrategyBacktestData } from './staticRange'
import { poolById, getPoolHourData } from './uniPoolData'
import { DateByDaysAgo, S_YEAR } from './utils'
import { getRewardAprs } from './uniPoolData'

// assume .2% slippage + .1% fees
const SLIPPAGE = 0.002 + 0.001

export const rebalanceBacktest = async (
  pool,
  options: RebalanceTestOptions,
) => {
  const opt: RebalanceTestOptions = {
    days: 30,
    protocol: 0,
    period: 'hourly',
    rebalanceType: 'threshold',
    ...options,
  }

  const poolData = await poolById(pool, opt.protocol)

  // TODO this is logic for perpetual only
  if (opt.priceToken == null)
    opt.priceToken = poolData.token0.symbol === 'vUSD' ? 0 : 1

  const baseAsset =
    opt.priceToken == 1 ? poolData.token0.symbol : poolData.token1.symbol
  const allAprs = await getRewardAprs()
  const rewardApis = allAprs.find((r) => r.baseSymbol == baseAsset)

  const rewardRatio =
    (rewardApis.riskLevelRewardAprs[1] + rewardApis.riskLevelRewardOpAprs[1]) /
    rewardApis.riskLevelBaseAprs[1]

  const { days } = opt
  let { startTimestamp, endTimestamp } = opt
  if (!endTimestamp) endTimestamp = Math.floor(Date.now() / 1000)

  if (!startTimestamp && days)
    startTimestamp = DateByDaysAgo(days, endTimestamp)

  if (!startTimestamp) throw new Error('Missing start date')

  const hourlyPriceData = await getPoolHourData(
    pool,
    startTimestamp,
    endTimestamp,
    opt.protocol,
  )

  if (!poolData || !hourlyPriceData || hourlyPriceData.length == 0)
    throw new Error('missing data')

  const priceData = hourlyPriceData.reverse()
  const balance = 30000

  const backtestState: BacktestState = {
    poolData,
    balance,
    apr: 0,
    fees: 0,
    il: 0,
    results: [],
    startBalance: balance,
    rewardRatio,
  }
  const endState = await processNextPeriod(priceData, backtestState, opt)

  const adjust = S_YEAR / (endTimestamp - startTimestamp)

  endState.apr = (adjust * (endState.balance - balance)) / balance
  endState.il = (adjust * endState.il) / balance
  endState.fees = (adjust * endState.fees) / balance

  console.log('----- FINAL -----')
  console.log('APR', toPercent(endState.apr))
  console.log('IL APR', toPercent(endState.il))
  console.log('Fees APR', toPercent(endState.fees))
  return endState
}

const processNextPeriod = async (data, state, opt) => {
  const { priceToken, positionRange } = opt
  const { balance, poolData, startBalance } = state

  const i = getRebalanceIndex(data, state, opt)
  console.log('index', i)
  const index = i < 0 ? -1 : i + 1
  const entryPrice = priceToken === 1 ? 1 / data[0].close : data[0].close

  const currentRange = index > 0 ? data.slice(0, index) : data

  const backtestSegment = await uniswapStrategyBacktestData(
    poolData,
    currentRange,
    balance,
    entryPrice * (1 - positionRange),
    entryPrice * (1 + positionRange),
    {
      priceToken,
    },
  )
  const start = backtestSegment[0]

  const periodEnd = backtestSegment[backtestSegment.length - 1]
  const tokenStart = start.tokens[1]
  const impermanentPosition = periodEnd.tokens[1] - start.tokens[1]
  const notional = periodEnd.tokens[0] - start.tokens[0]

  const startPrice = parseFloat(start.baseClose)
  const endPrice = parseFloat(periodEnd.baseClose)

  let accumulatedFees = 0
  const valueTimeSeries = backtestSegment.map((d, i) => {
    accumulatedFees += (d.feeV / 3) * 0.9 * (1 + state.rewardRatio) // approximate the .1% perp fees from uni fees .3 fees.
    const intervalNotional = d.tokens[0] - start.tokens[0]
    const intervalPosition = d.tokens[1] - tokenStart
    const pnl = intervalNotional + intervalPosition * d.baseClose
    return {
      ...d,
      value: (state.balance + accumulatedFees + pnl) / startBalance - 1,
      rebalance: index > 0 && i === backtestSegment.length - 1 ? 1 : 0,
    }
  })

  const permanentLoss = notional + impermanentPosition * endPrice

  state.il += permanentLoss
  state.fees += accumulatedFees

  state.balance =
    state.balance + accumulatedFees + permanentLoss * (1 + SLIPPAGE)

  logPeriod()

  // throw away the first datapoint since its the same as the final one from prev period
  if (state.results.length) valueTimeSeries.shift()
  state.results = [...state.results, ...valueTimeSeries]

  if (index <= 0 || index === data.length) return state

  return processNextPeriod(data.slice(index - 1), state, opt)

  function logPeriod() {
    console.log('----- rebalance point ----')
    console.log('priceMove', toPercent((startPrice - endPrice) / startPrice))
    console.log('fees + rewards', accumulatedFees)
    console.log('fees', accumulatedFees / (1 + state.rewardRatio))
    console.log(
      'rewards',
      (accumulatedFees * state.rewardRatio) / (1 + state.rewardRatio),
    )
    console.log('lp balance', periodEnd.amountV)
    console.log('permanentLoss', toPercent(permanentLoss / balance))
    console.log('permanentLoss', permanentLoss)
    console.log('total balance', state.balance)
    console.log()
  }
}

const getRebalanceIndex = (data, state, opt) => {
  const { priceToken, rebalanceThreshold, rebalanceType, startTimestamp } = opt
  if (!data.length) return -1

  const periodStart = state.lastRebalance
    ? state.lastRebalance.periodStartUnix
    : startTimestamp
  if (rebalanceType == 'daily')
    return data.findIndex((d) => {
      if (d.periodStartUnix - periodStart >= 60 * 60 * 24) {
        state.lastRebalance = d
        return true
      }
      return false
    })

  const entryPriceUnadjusted =
    state.lastRebalance != null ? state.lastRebalance.close : data[0].close

  const entryPrice =
    priceToken === 1 ? 1 / entryPriceUnadjusted : entryPriceUnadjusted

  return data.findIndex((d) => {
    const price = priceToken === 1 ? 1 / d.close : d.close
    const priceOffset = Math.abs(price - entryPrice) / entryPrice
    if (priceOffset > rebalanceThreshold) {
      console.log(priceOffset)
      state.lastRebalance = d
      return true
    }
    return false
  })
}

const toPercent = (n: number) => `${(100 * n).toFixed(2)}%`
