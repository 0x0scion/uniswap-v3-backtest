// import { Asset } from '@sc1/common/utils'

export * from './args'

export const END = new Date()
export const START = new Date(new Date().setFullYear(END.getFullYear() - 1))

export const MS_DAY = 1000 * 60 * 60 * 24
export const S_DAY = 60 * 60 * 24
export const MS_YEAR = 365 * MS_DAY
export const S_YEAR = 365 * S_DAY

const assetPairs = {
  ETHUSDC: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
}

// export const getAssetPair = (asset: Asset): string => assetPairs[asset]

export const getIL = (price: number, newPrice: number): number => {
  const change = getChange(price, newPrice)
  return Math.sqrt(1 + change) - 1
}

export const getChange = (price: number, newPrice: number): number => {
  return (newPrice - price) / price
}

export const fmtPrcnt = (n: number): string => {
  return `${(100 * n).toFixed(2)}%`
}

export const div1000 = (n: number): number => {
  return Math.floor(n / 1000)
}
