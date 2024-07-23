/* eslint-disable prefer-const */
import { BigDecimal, BigInt, ethereum, log, Address} from '@graphprotocol/graph-ts'
import {
  Bundle,
  Pair,
  PairDayData,
  PairSixHourData,
  Token,
  TokenDayData,
  UniswapDayData,
  UniswapFactory,
} from '../types/schema'
import { PairHourData } from './../types/schema'
import { FACTORY_ADDRESS, ONE_BI, ZERO_BD, ZERO_BI } from './helpers'
import {getPairPriceUSD} from "./pricing";

function calculateChange(previousValue: BigDecimal, currentValue: BigDecimal): BigDecimal {
  if (previousValue.equals(ZERO_BD)) {
    // Avoid division by zero
    return ZERO_BD;
  }

  let oneHundredBD = BigDecimal.fromString('100');
  return currentValue.minus(previousValue).div(previousValue).times(oneHundredBD); // 计算涨幅百分比
}

export function updateUniswapDayData(event: ethereum.Event): UniswapDayData {
  let uniswap = UniswapFactory.load(FACTORY_ADDRESS)
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let uniswapDayData = UniswapDayData.load(dayID.toString())
  if (uniswapDayData === null) {
    uniswapDayData = new UniswapDayData(dayID.toString())
    uniswapDayData.date = dayStartTimestamp
    uniswapDayData.dailyVolumeUSD = ZERO_BD
    uniswapDayData.dailyVolumeETH = ZERO_BD
    uniswapDayData.totalVolumeUSD = ZERO_BD
    uniswapDayData.totalVolumeETH = ZERO_BD
    uniswapDayData.dailyVolumeUntracked = ZERO_BD
  }

  uniswapDayData.totalLiquidityUSD = uniswap!.totalLiquidityUSD
  uniswapDayData.totalLiquidityETH = uniswap!.totalLiquidityETH
  uniswapDayData.txCount = uniswap!.txCount
  uniswapDayData.save()

  return uniswapDayData as UniswapDayData
}

export function updatePairDayData(event: ethereum.Event): PairDayData {
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let dayPairID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString())
  let pair = Pair.load(event.address.toHexString())
  let pairDayData = PairDayData.load(dayPairID)
  let previousPairDayData = getPreviousNonNullPairDayData(dayID, event.address);

  if (pairDayData === null) {
    pairDayData = new PairDayData(dayPairID)
    pairDayData.startUnix = dayStartTimestamp
    pairDayData.token0 = pair!.token0
    pairDayData.token1 = pair!.token1
    pairDayData.pair = event.address.toHexString()
    pairDayData.volumeToken0 = ZERO_BD
    pairDayData.volumeToken1 = ZERO_BD
    pairDayData.volumeUSD = ZERO_BD
    pairDayData.txns = ZERO_BI
    pairDayData.swapTxns = ZERO_BI
    pairDayData.volumeChange = ZERO_BD
    pairDayData.priceUSD = ZERO_BD
    pairDayData.priceChange = ZERO_BD
    pairDayData.buyTxs = ZERO_BI
    pairDayData.sellTxs = ZERO_BI
    pairDayData.basePriceUSD = pair!.priceUSD
    pairDayData.buyVolumeUSD = ZERO_BD
    pairDayData.sellVolumeUSD = ZERO_BD

    pairDayData.time = dayStartTimestamp
    pairDayData.low = pair!.priceUSD
    pairDayData.high = pair!.priceUSD
    if(previousPairDayData !== null){
      pairDayData.open = previousPairDayData!.close
    }else{
      pairDayData.open = pair!.priceUSD
    }
    pairDayData.close = pair!.priceUSD
  }
  pairDayData.priceUSD = pair!.priceUSD

  if (previousPairDayData !== null) {
    let previousDailyVolumeUSD = previousPairDayData.volumeUSD;
    let currentDailyVolumeUSD = pairDayData.volumeUSD;
    let dailyVolumeChange = calculateChange(previousDailyVolumeUSD, currentDailyVolumeUSD);
    pairDayData.volumeChange = dailyVolumeChange;

    let previousDailyPriceUSD = previousPairDayData.priceUSD;
    let currentDailyPriceUSD = pairDayData.priceUSD;
    pairDayData.priceChange = calculateChange(previousDailyPriceUSD, currentDailyPriceUSD)
  }else{
    pairDayData.priceChange = calculateChange(pairDayData.basePriceUSD, pairDayData.priceUSD)
  }

  if (pair!.priceUSD < pairDayData.low){
    pairDayData.low = pair!.priceUSD
  }

  if (pair!.priceUSD > pairDayData.high){
    pairDayData.high = pair!.priceUSD
  }

  pairDayData.close = pair!.priceUSD

  pairDayData.totalSupply = pair!.totalSupply
  pairDayData.reserve0 = pair!.reserve0
  pairDayData.reserve1 = pair!.reserve1
  pairDayData.reserveUSD = pair!.reserveUSD
  pairDayData.txns = pairDayData.txns.plus(ONE_BI)
  pairDayData.save()

  return pairDayData as PairDayData
}

export function updatePairHourData(event: ethereum.Event): PairHourData {
  let timestamp = event.block.timestamp.toI32()
  let hourIndex = timestamp / 3600 // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600 // want the rounded effect
  let hourPairID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(hourIndex).toString())
  let pair = Pair.load(event.address.toHexString())
  let pairHourData = PairHourData.load(hourPairID)
  
  let previousPairHourData = getPreviousNonNullPairHourData(hourIndex, event.address);


  if (pairHourData === null) {
    pairHourData = new PairHourData(hourPairID)
    pairHourData.startUnix = hourStartUnix
    pairHourData.pair = event.address.toHexString()
    pairHourData.volumeToken0 = ZERO_BD
    pairHourData.volumeToken1 = ZERO_BD
    pairHourData.volumeUSD = ZERO_BD
    pairHourData.txns = ZERO_BI
    pairHourData.swapTxns = ZERO_BI
    pairHourData.volumeChange = ZERO_BD
    pairHourData.priceUSD = ZERO_BD
    pairHourData.priceChange = ZERO_BD
    pairHourData.buyTxs = ZERO_BI
    pairHourData.sellTxs = ZERO_BI
    pairHourData.basePriceUSD = pair!.priceUSD
    pairHourData.buyVolumeUSD = ZERO_BD
    pairHourData.sellVolumeUSD = ZERO_BD
    pairHourData.time = hourStartUnix
    pairHourData.low = pair!.priceUSD
    pairHourData.high = pair!.priceUSD
    if(previousPairHourData !== null){
      pairHourData.open = previousPairHourData!.close
    }else{
      pairHourData.open = pair!.priceUSD
    }
    pairHourData.close = pair!.priceUSD
  }

  pairHourData.priceUSD = pair!.priceUSD

  if (previousPairHourData !== null) {
    let previousHourVolumeUSD = previousPairHourData.volumeUSD;
    let currentHourVolumeUSD = pairHourData.volumeUSD;
    let hourVolumeChange = calculateChange(previousHourVolumeUSD, currentHourVolumeUSD);
    pairHourData.volumeChange = hourVolumeChange;

    let previousHourPriceUSD = previousPairHourData.priceUSD;
    let currentHourPriceUSD = pairHourData.priceUSD;
    pairHourData.priceChange = calculateChange(previousHourPriceUSD, currentHourPriceUSD)
  }else{
    pairHourData.priceChange = calculateChange(pairHourData.basePriceUSD, pairHourData.priceUSD)
  }

  if (pair!.priceUSD < pairHourData.low){
    pairHourData.low = pair!.priceUSD
  }

  if (pair!.priceUSD > pairHourData.high){
    pairHourData.high = pair!.priceUSD
  }

  pairHourData.close = pair!.priceUSD

  pairHourData.totalSupply = pair!.totalSupply
  pairHourData.reserve0 = pair!.reserve0
  pairHourData.reserve1 = pair!.reserve1
  pairHourData.reserveUSD = pair!.reserveUSD
  pairHourData.txns = pairHourData.txns.plus(ONE_BI)
  pairHourData.save()

  return pairHourData as PairHourData
}

export function updatePairSixHourData(event: ethereum.Event): PairSixHourData {
  let timestamp = event.block.timestamp.toI32()
  let sixHourIndex = timestamp / 21600 // get unique hour within unix history
  let sixHourStartUnix = sixHourIndex * 21600 // want the rounded effect
  let sixHourPairID = event.address
      .toHexString()
      .concat('-')
      .concat(BigInt.fromI32(sixHourIndex).toString())
  let pair = Pair.load(event.address.toHexString())
  let pairSixHourData = PairSixHourData.load(sixHourPairID)

  let previousPairSixHourData = getPreviousNonNullPairSixHourData(sixHourIndex, event.address);

  if (pairSixHourData === null) {
    pairSixHourData = new PairSixHourData(sixHourPairID)
    pairSixHourData.startUnix = sixHourStartUnix
    pairSixHourData.pair = event.address.toHexString()
    pairSixHourData.volumeToken0 = ZERO_BD
    pairSixHourData.volumeToken1 = ZERO_BD
    pairSixHourData.volumeUSD = ZERO_BD
    pairSixHourData.txns = ZERO_BI
    pairSixHourData.swapTxns = ZERO_BI
    pairSixHourData.volumeChange = ZERO_BD
    pairSixHourData.priceUSD = ZERO_BD
    pairSixHourData.priceChange = ZERO_BD
    pairSixHourData.buyTxs = ZERO_BI
    pairSixHourData.sellTxs = ZERO_BI
    pairSixHourData.basePriceUSD = pair!.priceUSD
    pairSixHourData.buyVolumeUSD = ZERO_BD
    pairSixHourData.sellVolumeUSD = ZERO_BD

    pairSixHourData.time = sixHourStartUnix
    pairSixHourData.low = pair!.priceUSD
    pairSixHourData.high = pair!.priceUSD
    if(previousPairSixHourData !== null){
      pairSixHourData.open = previousPairSixHourData!.close
    }else{
      pairSixHourData.open = pair!.priceUSD
    }
    pairSixHourData.close = pair!.priceUSD
  }

  pairSixHourData.priceUSD = pair!.priceUSD

  if (previousPairSixHourData !== null) {
    let previousSixHourVolumeUSD = previousPairSixHourData.volumeUSD;
    let currentSixHourVolumeUSD = pairSixHourData.volumeUSD;
    let hourVolumeChange = calculateChange(previousSixHourVolumeUSD, currentSixHourVolumeUSD);
    pairSixHourData.volumeChange = hourVolumeChange;

    let previousSixHourPriceUSD = previousPairSixHourData.priceUSD;
    let currentSixHourPriceUSD = pairSixHourData.priceUSD;
    pairSixHourData.priceChange = calculateChange(previousSixHourPriceUSD, currentSixHourPriceUSD)
  }else{
    pairSixHourData.priceChange = calculateChange(pairSixHourData.basePriceUSD, pairSixHourData.priceUSD)
  }

  if (pair!.priceUSD < pairSixHourData.low){
    pairSixHourData.low = pair!.priceUSD
  }

  if (pair!.priceUSD > pairSixHourData.high){
    pairSixHourData.high = pair!.priceUSD
  }

  pairSixHourData.close = pair!.priceUSD

  pairSixHourData.totalSupply = pair!.totalSupply
  pairSixHourData.reserve0 = pair!.reserve0
  pairSixHourData.reserve1 = pair!.reserve1
  pairSixHourData.reserveUSD = pair!.reserveUSD
  pairSixHourData.txns = pairSixHourData.txns.plus(ONE_BI)
  pairSixHourData.save()

  return pairSixHourData as PairSixHourData
}

export function updateTokenDayData(token: Token, event: ethereum.Event): TokenDayData {
  let bundle = Bundle.load('1')
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let tokenDayID = token.id
    .toString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString())

  let tokenDayData = TokenDayData.load(tokenDayID)
  if (tokenDayData === null) {
    tokenDayData = new TokenDayData(tokenDayID)
    tokenDayData.date = dayStartTimestamp
    tokenDayData.token = token.id
    tokenDayData.priceUSD = token.derivedETH!.times(bundle!.ethPrice)
    tokenDayData.dailyVolumeToken = ZERO_BD
    tokenDayData.dailyVolumeETH = ZERO_BD
    tokenDayData.dailyVolumeUSD = ZERO_BD
    tokenDayData.dailyTxns = ZERO_BI
    tokenDayData.totalLiquidityUSD = ZERO_BD
  }
  tokenDayData.priceUSD = token.derivedETH!.times(bundle!.ethPrice)
  tokenDayData.totalLiquidityToken = token.totalLiquidity
  tokenDayData.totalLiquidityETH = token.totalLiquidity.times(token.derivedETH as BigDecimal)
  tokenDayData.totalLiquidityUSD = tokenDayData.totalLiquidityETH.times(bundle!.ethPrice)
  tokenDayData.dailyTxns = tokenDayData.dailyTxns.plus(ONE_BI)
  tokenDayData.save()

  /**
   * @todo test if this speeds up sync
   */
  // updateStoredTokens(tokenDayData as TokenDayData, dayID)
  // updateStoredPairs(tokenDayData as TokenDayData, dayPairID)

  return tokenDayData as TokenDayData
}

function getPreviousNonNullPairSixHourData(
  currentIndex: number,
  eventAddress: Address
): PairSixHourData | null {
  let previousIndex = currentIndex - 1;
  let maxStepsBack = 1000;

  while (previousIndex >= 0 && maxStepsBack > 0) {
    let previousSixHourPairID = eventAddress
      .toHexString()
      .concat('-')
      .concat(BigInt.fromI32(previousIndex  as i32).toString());
    let previousPairSixHourData = PairSixHourData.load(previousSixHourPairID);

    if (previousPairSixHourData !== null) {
      return previousPairSixHourData;
    }

    previousIndex -= 1;
    maxStepsBack -= 1;
  }

  return null;
}

function getPreviousNonNullPairHourData(
  currentIndex: number,
  eventAddress: Address
): PairHourData | null {
  let previousIndex = currentIndex - 1;
  let maxStepsBack = 1000;

  while (previousIndex >= 0 && maxStepsBack > 0) {
    let previousHourPairID = eventAddress
      .toHexString()
      .concat('-')
      .concat(BigInt.fromI32(previousIndex  as i32).toString());
    let previousPairHourData = PairHourData.load(previousHourPairID);

    if (previousPairHourData !== null) {
      return previousPairHourData;
    }

    previousIndex -= 1;
    maxStepsBack -= 1;
  }

  return null;
}

function getPreviousNonNullPairDayData(
  currentIndex: number,
  eventAddress: Address
): PairDayData | null {
  let previousIndex = currentIndex - 1;
  let maxStepsBack = 1000;
  while (previousIndex >= 0 && maxStepsBack > 0) {
    let previousDayPairID = eventAddress
      .toHexString()
      .concat('-')
      .concat(BigInt.fromI32(previousIndex as i32).toString());
    let previousPairDayData = PairDayData.load(previousDayPairID);

    if (previousPairDayData !== null) {
      return previousPairDayData;
    }

    previousIndex -= 1;
    maxStepsBack -= 1;
  }

  return null;
}