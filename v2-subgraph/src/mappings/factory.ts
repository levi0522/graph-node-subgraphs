/* eslint-disable prefer-const */
import { Address, BigInt, log } from '@graphprotocol/graph-ts'
import { PairCreated } from '../types/Factory/Factory'
import { Bundle, Pair, Token, UniswapFactory } from '../types/schema'
import { Pair as PairTemplate } from '../types/templates'
import {
  FACTORY_ADDRESS,
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenTotalSupply,
  ZERO_BD,
  ZERO_BI
} from './helpers'

let SKIP_BLOCKS: string[] = ["17308596", "18746374"]

// interface Stablecoin {
//     token0: string;
//     token1: string;
//     pairAddress: string;
// }
//
let token0s: string[] = [
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
]

let token1s: string[] = [
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "0xdAC17F958D2ee523a2206206994597C13D831ec7"
]

let pairs: string[] = [
  "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc",
  "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11",
  "0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852"
]
// let stablecoins: Stablecoin[] = [
//   {
//       token0: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
//       token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//       pairAddress: "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc"
//   },
//   {
//       token0: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
//       token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//       pairAddress: "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11"
//   },
//   {
//       token0: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//       token1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
//       pairAddress: "0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852"
//   }
// ]

export function handleNewPair(event: PairCreated): void {
  // load factory (create if first exchange)
  let factory = UniswapFactory.load(FACTORY_ADDRESS)
  if (factory === null) {
    factory = new UniswapFactory(FACTORY_ADDRESS)
    factory.pairCount = 0
    factory.totalVolumeETH = ZERO_BD
    factory.totalLiquidityETH = ZERO_BD
    factory.totalVolumeUSD = ZERO_BD
    factory.untrackedVolumeUSD = ZERO_BD
    factory.totalLiquidityUSD = ZERO_BD
    factory.txCount = ZERO_BI

    // create new bundle
    let bundle = new Bundle('1')
    bundle.ethPrice = ZERO_BD
    bundle.save()

    for (let i = 0; i < 3; i++) {
      let token0Address: string = token0s[i];
      let token1Address: string = token1s[i];
      let pairAddress: string = pairs[i];

      factory.pairCount = factory.pairCount + 1
      factory.save()

      // create the tokens
      let token0 = Token.load(token0Address)
      let token1 = Token.load(token1Address)

      // fetch info if null
      if (token0 === null) {
        token0 = new Token(token0Address)
        token0.symbol = fetchTokenSymbol(Address.fromString(token0Address))
        token0.name = fetchTokenName(Address.fromString(token0Address))
        let decimals = fetchTokenDecimals(Address.fromString(token0Address))
        // bail if we couldn't figure out the decimals
        if (decimals === null) {
          log.debug('mybug the decimal on token 0 was null', [])
          return
        }
        token0.decimals = decimals

        token0.totalSupply = fetchTokenTotalSupply(token0Address, decimals)
        token0.derivedETH = ZERO_BD
        token0.tradeVolume = ZERO_BD
        token0.tradeVolumeUSD = ZERO_BD
        token0.untrackedVolumeUSD = ZERO_BD
        token0.totalLiquidity = ZERO_BD
        // token0.allPairs = []
        token0.txCount = ZERO_BI
      }

      // fetch info if null
      if (token1 === null) {
        token1 = new Token(token1Address)
        token1.symbol = fetchTokenSymbol(Address.fromString(token1Address))
        token1.name = fetchTokenName(Address.fromString(token1Address))
        let decimals = fetchTokenDecimals(Address.fromString(token1Address))
        // bail if we couldn't figure out the decimals
        if (decimals === null) {
          return
        }
        token1.decimals = decimals
        token1.totalSupply = fetchTokenTotalSupply(token1Address, decimals)


        token1.derivedETH = ZERO_BD
        token1.tradeVolume = ZERO_BD
        token1.tradeVolumeUSD = ZERO_BD
        token1.untrackedVolumeUSD = ZERO_BD
        token1.totalLiquidity = ZERO_BD
        // token1.allPairs = []
        token1.txCount = ZERO_BI
      }

      let pair = new Pair(pairAddress) as Pair
      pair.token0 = token0.id
      pair.token1 = token1.id
      pair.liquidityProviderCount = ZERO_BI
      pair.createdAtTimestamp = event.block.timestamp
      pair.createdAtBlockNumber = event.block.number
      pair.txCount = ZERO_BI
      pair.reserve0 = ZERO_BD
      pair.reserve1 = ZERO_BD
      pair.trackedReserveETH = ZERO_BD
      pair.reserveETH = ZERO_BD
      pair.reserveUSD = ZERO_BD
      pair.totalSupply = ZERO_BD
      pair.volumeToken0 = ZERO_BD
      pair.volumeToken1 = ZERO_BD
      pair.volumeUSD = ZERO_BD
      pair.untrackedVolumeUSD = ZERO_BD
      pair.token0Price = ZERO_BD
      pair.token1Price = ZERO_BD
      pair.liquidity = ZERO_BD
      pair.priceUSD = ZERO_BD
      pair.buyTxs = ZERO_BI
      pair.sellTxs = ZERO_BI
      pair.initialReserve0 = ZERO_BD
      pair.initialReserve1 = ZERO_BD
      pair.FDV = ZERO_BD
      pair.MKTCAP = ZERO_BD
      pair.tokenTotalSupply = ZERO_BD
      pair.initialReserve = ZERO_BD
      pair.buyVolumeUSD = ZERO_BD
      pair.sellVolumeUSD = ZERO_BD
      // create the tracked contract based on the template
      PairTemplate.create(Address.fromString(pairAddress))

      // save updated values
      token0.save()
      token1.save()
      pair.save()
    }
  }

  factory.pairCount = factory.pairCount + 1
  factory.save()
  // create the tokens
  let token0 = Token.load(event.params.token0.toHexString())
  let token1 = Token.load(event.params.token1.toHexString())

  for (let i = 0; i < SKIP_BLOCKS.length; ++i) {
    let skipBlock = BigInt.fromString(SKIP_BLOCKS[i])
    if (event.block.number == skipBlock) {
      return
    }
  }

  // fetch info if null
  if (token0 === null) {
    token0 = new Token(event.params.token0.toHexString())
    token0.symbol = fetchTokenSymbol(event.params.token0)
    token0.name = fetchTokenName(event.params.token0)
    let decimals = fetchTokenDecimals(event.params.token0)

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      log.debug('mybug the decimal on token 0 was null', [])
      return
    }

    token0.decimals = decimals
    token0.totalSupply = fetchTokenTotalSupply(event.params.token0.toHexString(), decimals)

    token0.derivedETH = ZERO_BD
    token0.tradeVolume = ZERO_BD
    token0.tradeVolumeUSD = ZERO_BD
    token0.untrackedVolumeUSD = ZERO_BD
    token0.totalLiquidity = ZERO_BD
    // token0.allPairs = []
    token0.txCount = ZERO_BI
  }
  // fetch info if null
  if (token1 === null) {
    token1 = new Token(event.params.token1.toHexString())
    token1.symbol = fetchTokenSymbol(event.params.token1)
    token1.name = fetchTokenName(event.params.token1)
    let decimals = fetchTokenDecimals(event.params.token1)

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      return
    }
    token1.decimals = decimals
    token1.totalSupply = fetchTokenTotalSupply(event.params.token1.toHexString(), decimals)

    token1.derivedETH = ZERO_BD
    token1.tradeVolume = ZERO_BD
    token1.tradeVolumeUSD = ZERO_BD
    token1.untrackedVolumeUSD = ZERO_BD
    token1.totalLiquidity = ZERO_BD
    // token1.allPairs = []
    token1.txCount = ZERO_BI
  }
  let pair = new Pair(event.params.pair.toHexString()) as Pair
  pair.token0 = token0.id
  pair.token1 = token1.id
  pair.liquidityProviderCount = ZERO_BI
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.txCount = ZERO_BI
  pair.reserve0 = ZERO_BD
  pair.reserve1 = ZERO_BD
  pair.trackedReserveETH = ZERO_BD
  pair.reserveETH = ZERO_BD
  pair.reserveUSD = ZERO_BD
  pair.totalSupply = ZERO_BD
  pair.volumeToken0 = ZERO_BD
  pair.volumeToken1 = ZERO_BD
  pair.volumeUSD = ZERO_BD
  pair.untrackedVolumeUSD = ZERO_BD
  pair.token0Price = ZERO_BD
  pair.token1Price = ZERO_BD
  pair.liquidity = ZERO_BD
  pair.priceUSD = ZERO_BD
  pair.buyTxs = ZERO_BI
  pair.sellTxs = ZERO_BI
  pair.initialReserve0 = ZERO_BD
  pair.initialReserve1 = ZERO_BD
  pair.FDV = ZERO_BD
  pair.MKTCAP = ZERO_BD
  pair.tokenTotalSupply = ZERO_BD
  pair.initialReserve = ZERO_BD
  pair.buyVolumeUSD = ZERO_BD
  pair.sellVolumeUSD = ZERO_BD
  // create the tracked contract based on the template
  PairTemplate.create(event.params.pair)

  // save updated values
  token0.save()
  token1.save()
  pair.save()
  factory.save()
}