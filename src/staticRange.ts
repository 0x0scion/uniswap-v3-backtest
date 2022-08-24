import { poolById, getPoolHourData } from './uniPoolData';
import {
  tokensForStrategy,
  liquidityForStrategy,
  calcFees,
  pivotFeeData,
} from './backtest';
import { TestOptions } from './types';

// data, pool, baseID, liquidity, unboundedLiquidity, min, max, customFeeDivisor, leverage, investment, tokenRatio
// Required = Pool ID, investmentAmount (token0 by default), minRange, maxRange, options = { days, protocol, baseToken }

export const uniswapStrategyBacktest = async (
  pool,
  investmentAmount,
  minRange,
  maxRange,
  options: TestOptions = {}
) => {
  const opt: TestOptions = {
    protocol: 0,
    priceToken: 0,
    period: 'hourly',
    ...options,
  };
  if (!pool) throw new Error('missing pool');

  const poolData = await poolById(pool);
  const { startTimestamp, endTimestamp } = opt;

  if (!startTimestamp) throw new Error('Missing start date');
  if (!endTimestamp) throw new Error('Missing end date');

  const hourlyPriceData = await getPoolHourData(
    pool,
    startTimestamp && Math.floor(startTimestamp / 1000),
    Math.floor(endTimestamp / 1000),
    opt.protocol
  );

  if (!poolData || !hourlyPriceData || hourlyPriceData.length == 0)
    throw new Error('missing data');

  const backtestData = hourlyPriceData.reverse();
  const entryPrice =
    opt.priceToken === 1 ? 1 / backtestData[0].close : backtestData[0].close;
  const tokens = tokensForStrategy(
    minRange,
    maxRange,
    investmentAmount,
    entryPrice,
    poolData.token1.decimals - poolData.token0.decimals
  );
  const liquidity = liquidityForStrategy(
    entryPrice,
    minRange,
    maxRange,
    tokens[0],
    tokens[1],
    poolData.token0.decimals,
    poolData.token1.decimals
  );
  const unbLiquidity = liquidityForStrategy(
    entryPrice,
    Math.pow(1.0001, -887220),
    Math.pow(1.0001, 887220),
    tokens[0],
    tokens[1],
    poolData.token0.decimals,
    poolData.token1.decimals
  );
  const hourlyBacktest = calcFees(
    backtestData,
    poolData,
    opt.priceToken,
    liquidity,
    unbLiquidity,
    investmentAmount,
    minRange,
    maxRange
  );
  return opt.period === 'daily'
    ? pivotFeeData(hourlyBacktest, opt.priceToken, investmentAmount)
    : hourlyBacktest;
};

export const uniswapStrategyBacktestData = async (
  poolData,
  hourlyPriceData,
  investmentAmount,
  minRange,
  maxRange,
  opt: TestOptions
) => {
  if (opt.priceToken == null) throw new Error('missing price token');

  if (!poolData || !hourlyPriceData || hourlyPriceData.length == 0)
    throw new Error('missing data');

  const backtestData = hourlyPriceData;

  const entryPrice =
    opt.priceToken === 1 ? 1 / backtestData[0].close : backtestData[0].close;

  const tokens = tokensForStrategy(
    minRange,
    maxRange,
    investmentAmount,
    entryPrice,
    poolData.token1.decimals - poolData.token0.decimals
  );
  const liquidity = liquidityForStrategy(
    entryPrice,
    minRange,
    maxRange,
    tokens[0],
    tokens[1],
    poolData.token0.decimals,
    poolData.token1.decimals
  );
  const unbLiquidity = liquidityForStrategy(
    entryPrice,
    Math.pow(1.0001, -887220),
    Math.pow(1.0001, 887220),
    tokens[0],
    tokens[1],
    poolData.token0.decimals,
    poolData.token1.decimals
  );
  const hourlyBacktest = calcFees(
    backtestData,
    poolData,
    opt.priceToken,
    liquidity,
    unbLiquidity,
    investmentAmount,
    minRange,
    maxRange
  );
  return opt.period === 'daily'
    ? pivotFeeData(hourlyBacktest, opt.priceToken, investmentAmount)
    : hourlyBacktest;
};
