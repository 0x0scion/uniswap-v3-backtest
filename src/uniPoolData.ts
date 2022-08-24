import fetch from 'node-fetch'

export const minTvl = (protocol) => {
  return protocol === 0 ? 10000 : 1
}

export const urlForProtocol = (protocol) => {
  return protocol === 1
    ? 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis'
    : protocol === 2
    ? 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal'
    : protocol === 3
    ? 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon'
    : protocol === 4
    ? 'https://api.thegraph.com/subgraphs/name/perpetual-protocol/perpetual-v2-optimism'
    : 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3'
}

export const getPoolHourData = async (pool, fromdate, todate, protocol = 0) => {
  const query = `query PoolHourDatas($pool: ID!, $fromdate: Int!, $todate: Int!) {
  poolHourDatas ( where:{ pool:$pool, periodStartUnix_gt:$fromdate periodStartUnix_lt:$todate close_gt: 0}, orderBy:periodStartUnix, orderDirection:desc, first:1000) {
    periodStartUnix
    liquidity
    high
    low
    pool {
      id
      totalValueLockedUSD
      totalValueLockedToken1
      totalValueLockedToken0
      token0
        {decimals}
      token1
        {decimals}
    }
    close
    feeGrowthGlobal0X128
    feeGrowthGlobal1X128
    }
  }
  `

  const url = urlForProtocol(protocol)

  let prevStart = 0
  let poolHourDatas: any = []

  // order is desc (latest date first)
  while (prevStart == 0 || prevStart > fromdate + 3600) {
    console.log('query from', todate, 'to', prevStart == 0 ? todate : prevStart)
    const response = await fetch(
      url,
      requestBody({
        query: query,
        variables: {
          pool: pool,
          fromdate,
          todate: prevStart == 0 ? todate : prevStart,
        },
      }),
    )
    const data: any = await response.json()
    const chunkData = data?.data?.poolHourDatas

    if (data?.errors) console.log(data?.errors)
    if (chunkData) {
      const startData = chunkData[chunkData.length - 1]
      // no more data - return
      if (!startData || prevStart == startData.periodStartUnix)
        return poolHourDatas
      poolHourDatas = [...poolHourDatas, ...chunkData]
      prevStart = startData.periodStartUnix
    } else {
      throw Error('nothing returned from getPoolHourData')
    }
  }
  return poolHourDatas
}

export const poolById = async (id, protocol = 0) => {
  const url = urlForProtocol(protocol)

  const poolQueryFields = `{
    id
    feeTier
    totalValueLockedUSD
    totalValueLockedETH
    token0Price
    token1Price  
    token0 {
      id
      symbol
      name
      decimals
    }
    token1 {
      id
      symbol
      name
      decimals
    }
    poolDayData(orderBy: date, orderDirection:desc,first:1)
    {
      date
      volumeUSD
      tvlUSD
      feesUSD
      liquidity
      high
      low
      volumeToken0
      volumeToken1
      close
      open
    }
  }`

  const query = `query Pools($id: ID!) { id: pools(where: { id: $id } orderBy:totalValueLockedETH, orderDirection:desc) 
   ${poolQueryFields}
  }`

  try {
    const response = await fetch(
      url,
      requestBody({ query: query, variables: { id: id } }),
    )
    const data: any = await response.json()

    if (data && data.data) {
      const pools = data.data

      if (pools.id && pools.id.length && pools.id.length === 1) {
        return pools.id[0]
      }
    } else {
      return null
    }
  } catch (error) {
    return { error: error }
  }
}

export const requestBody = (request) => {
  if (!request.query) return

  const body = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: request.query,
      variables: request.variables || {},
    }),
    signal: undefined,
  }

  if (request.signal) body.signal = request.signal
  return body
}
