/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt, log } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD, STABLECOINS } from './helpers'

const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
const USDC_WETH_PAIR = '0x1f0c5400a3c7e357cc7c9a3d2f7fe6ddf629d868'

export function getEthPriceInUSD(): BigDecimal {
  log.error("---------getEthPriceInUSD---------------", [])
  // fetch eth prices for each stablecoin
  let usdcPair = Pair.load(USDC_WETH_PAIR) // usdc is token0
  //aaa
  // all 3 have been created
  if (usdcPair !== null) {
    log.error("---------usdcPair !== null-----------------"+usdcPair.token0Price.toString(),[])
    return usdcPair.token0Price
  } else {
    log.error("---------usdcPair == null-----------------", [])
    return ZERO_BD
  }
}

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('4000')

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('2')

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WMATIC_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < STABLECOINS.length; ++i) {
    let pairAddress = Address.fromString(ADDRESS_ZERO);
    let callResult = factoryContract.try_getPair(Address.fromString(token.id), Address.fromString(STABLECOINS[i]));

    if (callResult.reverted) {
      return ZERO_BD;
    } else {
      pairAddress = callResult.value;
    }

    if (pairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedETH as BigDecimal) // return token1 per our token * Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedETH as BigDecimal) // return token0 per our token * ETH per token 0
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.maticPrice)
  let price1 = token1.derivedETH.times(bundle.maticPrice)

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0)
    let reserve1USD = pair.reserve1.times(price1)
    if (STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (STABLECOINS.includes(token0.id) && !STABLECOINS.includes(token1.id)) {
      if (reserve0USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (!STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
      if (reserve1USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
  }

  // take full value of the whitelisted token amount
  if (STABLECOINS.includes(token0.id) && !STABLECOINS.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.maticPrice)
  let price1 = token1.derivedETH.times(bundle.maticPrice)

  // both are whitelist tokens, take average of both amounts
  if (STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the STABLECOINSed token amount
  if (STABLECOINS.includes(token0.id) && !STABLECOINS.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the STABLECOINSed token amount
  if (!STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

export function getPairPriceUSD(
  token0: Token,
  token1: Token,
  pair: Pair,
): BigDecimal {
  log.error("-------------getPairPriceUSD---------------",[])
  if (pair.reserve1.equals(ZERO_BD) || pair.reserve0.equals(ZERO_BD)) {
    return ZERO_BD;
  }
  log.error("-------------getPairPriceUSD 11 111---------------",[])
  log.error("-------------reserve1---------------"+pair.reserve1.toString(),[])
  log.error("-------------reserve0---------------"+pair.reserve0.toString(),[])
  log.error("-------------token0---------------"+token0.id.toString(),[])
  log.error("-------------token1---------------"+token1.id.toString(),[])
  let bundle = Bundle.load('1')
  log.error("--------------bundle.maticPrice-----------------"+bundle.maticPrice.toString(),[])
  if (STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    log.error("-------------getPairPriceUSD 2222---------------",[])
    if (token1.id == WMATIC_ADDRESS) {
      log.error("-------------getPairPriceUSD 2222 WMATIC_ADDRESS---------------",[])
      return pair.reserve1.div(pair.reserve0).times(bundle.maticPrice);
    }
    return pair.reserve1.div(pair.reserve0);
  }

  if (STABLECOINS.includes(token0.id) && !STABLECOINS.includes(token1.id)) {
    log.error("-------------getPairPriceUSD 33333---------------",[])
    if (token0.id == WMATIC_ADDRESS) {
      log.error("-------------getPairPriceUSD 33333 WMATIC_ADDRESS---------------",[])
      return pair.reserve0.div(pair.reserve1).times(bundle.maticPrice);
    }
    return pair.reserve0.div(pair.reserve1)
  }

  if (!STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    log.error("-------------getPairPriceUSD 44444---------------",[])
    if (token1.id == WMATIC_ADDRESS) {
      log.error("-------------getPairPriceUSD 44444 WMATIC_ADDRESS---------------",[])
      return pair.reserve1.div(pair.reserve0).times(bundle.maticPrice);
    }
    return pair.reserve1.div(pair.reserve0)
  }
  return ZERO_BD;
}

export function getPairFDV(
  token0: Token,
  token1: Token,
  price: BigDecimal,
): BigDecimal {
  if (price.equals(ZERO_BD)) {
    return ZERO_BD;
  }
  if (STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return token0.totalSupply.times(price);
  }

  if (STABLECOINS.includes(token0.id) && !STABLECOINS.includes(token1.id)) {
    return token1.totalSupply.times(price);
  }

  if (!STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return token0.totalSupply.times(price);
  }
  return ZERO_BD;
}

export function getPairTokenTotalSupply(
  token0: Token,
  token1: Token,
): BigDecimal {
  if (STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return token0.totalSupply;
  }

  if (STABLECOINS.includes(token0.id) && !STABLECOINS.includes(token1.id)) {
    return token1.totalSupply;
  }

  if (!STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return token0.totalSupply;
  }
  return token0.totalSupply;
}

export function getPairInitialReserve(
  token0: Token,
  token1: Token,
  pair: Pair,
): BigDecimal {
  if (STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return pair.initialReserve1;
  }

  if (STABLECOINS.includes(token0.id) && !STABLECOINS.includes(token1.id)) {
    return pair.initialReserve0;
  }

  if (!STABLECOINS.includes(token0.id) && STABLECOINS.includes(token1.id)) {
    return pair.initialReserve1;
  }
  return pair.initialReserve1;
}