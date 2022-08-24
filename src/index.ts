import { rebalanceBacktest } from './rebalance'
import { S_DAY } from './utils'

export { rebalanceBacktest } from './rebalance'

export const perpetualBacktest = async (args) => {
  const {
    asset = '0x36b18618c4131d8564a714fb6b4d2b1edadc0042',
    start,
    end,
    positionRange = 0.2,
    rebalanceThreshold,
  } = args
  // TODO figure out price token
  const backtestData = await rebalanceBacktest(asset, {
    positionRange: positionRange,
    rebalanceThreshold: rebalanceThreshold,
    // days: 30,
    startTimestamp: start,
    endTimestamp: end,
    period: 'hourly',
    protocol: 1,
    priceToken: 1,
    ...args,
  })

  // aggregate to days to make zoom work better
  const data = [backtestData.results[0]]
  let n = 1

  backtestData.results.forEach((d) => {
    const lastData = data[data.length - 1]
    const lastDate = new Date(lastData.periodStartUnix * 1000)
    const currentDate = new Date(d.periodStartUnix * 1000)
    if (lastDate.getDay() == currentDate.getDay()) {
      lastData.value = (n * lastData.value + d.value) / (n + 1)
      lastData.baseClose = (n * lastData.baseClose + d.baseClose) / (n + 1)
      lastData.rebalance += d.rebalance
      lastData.periodStartUnix = d.periodStartUnix
      n++
      return
    }
    data.push(d)
    n = 1
  })

  const maxDayLoss = data.reduce((a, d, i) => {
    if (i == 0) return 0
    const loss = data[i - 1].value - d.value
    return loss > a ? loss : a
  }, 0)

  const rebalances = data.reduce((a, d) => d.rebalance + a, 0)

  const res = {
    data: data.map((d) => ({
      timestamp: d.periodStartUnix,
      value: d.value - 100,
      price: d.baseClose,
      rebalance: d.rebalance,
    })),
    stats: {
      APR: backtestData.apr,
      'Fees APR': backtestData.fees,
      'IL APR': -backtestData.il,
      'Rebalance per Day': 100 * (rebalances / (end - start)) * S_DAY,
      'Max 1d Drawdown': maxDayLoss,
    },
  }
  return res
}

const main = async () => {
  const backtestResults = await rebalanceBacktest(
    // '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
    '0x36b18618c4131d8564a714fb6b4d2b1edadc0042', // perp vUSDC-vETH
    // '0x1c3140ab59d6caf9fa7459c6f83d4b52ba881d36', // OP-USDC
    {
      positionRange: 0.1,
      rebalanceThreshold: 0.08,
      days: 90,
      period: 'hourly',
      protocol: 1,
      priceToken: 1,
    },
  )
  backtestResults.results.forEach((r, i) => {
    if (i == 0) return
    const prev = backtestResults.results[i - 1]
    if (r.periodStartUnix == prev.periodStartUnix) {
      console.log('duplicates', i, r.periodStartUnix, prev.periodStartUnix)
    }
  })
  // console.log(backtestResults.results[0])
  // console.log(backtestResults.results[backtestResults.results.length - 1])
}

main()
