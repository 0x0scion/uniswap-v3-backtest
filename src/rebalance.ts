import { RebalanceTestOptions, BacktestState } from './types'
import { uniswapStrategyBacktestData } from './staticRange'
import { poolById, getPoolHourData } from './uniPoolData'
import { DateByDaysAgo, S_YEAR } from './utils'

export const rebalanceBacktest = async (
  pool,
  options: RebalanceTestOptions,
) => {
  const opt: RebalanceTestOptions = {
    days: 30,
    protocol: 0,
    period: 'hourly',
    ...options,
  }

  const poolData = await poolById(pool, opt.protocol)

  // TODO this is logic for perpetual only
  if (opt.priceToken == null)
    opt.priceToken = poolData.token0.symbol === 'vUSD' ? 0 : 1

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
  const balance = 100

  const backtestState: BacktestState = {
    poolData,
    balance,
    apr: 0,
    fees: 0,
    il: 0,
    results: [],
  }
  const endState = await processNextPeriod(priceData, backtestState, opt)

  const adjust = S_YEAR / (endTimestamp - startTimestamp)

  endState.apr = adjust * (endState.balance - balance)
  endState.il = adjust * endState.il
  endState.fees = adjust * endState.fees

  console.log('----- FINAL -----')
  console.log('APR', toPercent(endState.apr / balance))
  console.log('IL APR', toPercent(endState.il / balance))
  console.log('Fees APR', toPercent(endState.fees / balance))
  return endState
}

const processNextPeriod = async (data, state, opt) => {
  const { priceToken, positionRange } = opt
  const { balance, poolData } = state

  const i = getRebalanceIndex(data, opt)
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
  const hedgeAmnt = start.tokens[1]

  const startPrice = parseFloat(start.baseClose)
  const endPrice = parseFloat(periodEnd.baseClose)

  let accumulatedFees = 0
  const valueTimeSeries = backtestSegment.map((d, i) => {
    accumulatedFees += d.feeV
    const hedge = hedgeAmnt * (startPrice - d.baseClose)
    return {
      ...d,
      value: d.amountV + accumulatedFees + hedge,
      rebalance: index > 0 && i === backtestSegment.length - 1 ? 1 : 0,
    }
  })
  state.results = [...state.results, ...valueTimeSeries]
  const hedgePNL = hedgeAmnt * (startPrice - endPrice)
  const currentIL = (balance - periodEnd.amountV - hedgePNL) / balance

  logPeriod()

  state.il += balance - periodEnd.amountV - hedgePNL
  state.fees += accumulatedFees

  state.balance = periodEnd.amountV + accumulatedFees + hedgePNL
  // console.log('balance', state.balance);
  if (index <= 0 || index === data.length) return state

  return processNextPeriod(data.slice(index), state, opt)

  function logPeriod() {
    console.log('----- rebalance point ----')
    console.log('priceMove', toPercent((startPrice - endPrice) / startPrice))
    console.log('fees', accumulatedFees, periodEnd.feesUSD)
    console.log('lp balance', periodEnd.amountV)
    console.log('hedgePNL', hedgePNL)
    console.log('il', toPercent(currentIL))
    console.log('total balance', state.balance)
    console.log()
  }
}

const getRebalanceIndex = (data, opt) => {
  const { priceToken, rebalanceThreshold } = opt
  if (!data.length) return -1
  const entryPrice = priceToken === 1 ? 1 / data[0].close : data[0].close

  return data.findIndex((d) => {
    const price = priceToken === 1 ? 1 / d.close : d.close
    const priceOffset = Math.abs(price - entryPrice) / entryPrice
    return priceOffset > rebalanceThreshold
  })
}

const toPercent = (n: number) => `${(100 * n).toFixed(2)}%`
