// import { Asset, Assets } from '@sc1/common/utils';

export interface BacktestQuery {
  asset: string
  start?: string
  end?: string
  days?: string
  positionRange?: string
  rebalanceThreshold: string
}

export interface BacktestArgs {
  asset?: string
  start: number
  end: number
  positionRange?: number
  rebalanceThreshold: number
}

// export interface UniV3Args {
//   asset: Asset;
//   start: number;
//   end: number;
//   rebalanceThreshold: number;
// }

// export const uniV2Params = (args: BacktestQuery) => {
//   const asset = args.asset as Asset;
//   if (!Assets.includes(asset)) throw new Error('Bad asset');
//   const tArgs = transformParams(args);
//   return {
//     asset,
//     start: tArgs.start * 1000,
//     end: tArgs.end * 1000,
//     rebalanceThreshold: tArgs.rebalanceThreshold,
//   };
// };

export const transformParams = (args: BacktestQuery): BacktestArgs => {
  const {
    asset,
    days: daysStr = '365',
    start: startStr,
    end: endStr,
    positionRange,
    rebalanceThreshold,
  } = args
  const [start, end] = getEndStart(qInt(startStr), qInt(endStr), qInt(daysStr))
  if (rebalanceThreshold == null) throw new Error('missing rebalance threshold')
  return {
    asset,
    start,
    end,
    positionRange: qFloat(positionRange),
    rebalanceThreshold: qFloat(rebalanceThreshold)!,
  }
}

export const getEndStart = (
  start?: number,
  end = Math.floor(Date.now() / 1000),
  days?: number,
): [number, number] => {
  if (!start && days) start = DateByDaysAgo(days, end)
  if (!start) throw new Error('Missing backtest start or duration')
  return [start, end]
}

export const DateByDaysAgo = (days: number, endDate?: number) => {
  const date = endDate ? new Date(endDate * 1000) : new Date()
  return Math.round(date.setDate(date.getDate() - days) / 1000)
}

export const qInt = (n: string | undefined) =>
  n == undefined ? undefined : parseInt(n, 10)

export const qFloat = (n: string | undefined) =>
  n == undefined ? undefined : parseFloat(n)
