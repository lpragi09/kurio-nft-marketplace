import Big from 'big.js'
import type { EthAmount } from '@/contracts/api'

// 18 decimals like wei; ROUND_HALF_EVEN keeps sums unbiased.
Big.DP = 18
Big.RM = Big.roundHalfEven

export const eth = (v: EthAmount | number = '0') => new Big(v)

export function sumEth(values: EthAmount[]): EthAmount {
  return values.reduce((acc, v) => acc.plus(v), new Big(0)).toString()
}

export function mulEth(price: EthAmount, qty: number): EthAmount {
  return new Big(price).times(qty).toString()
}

export function subEth(a: EthAmount, b: EthAmount): EthAmount {
  return new Big(a).minus(b).toString()
}

export function percentOf(amount: EthAmount, percent: number): EthAmount {
  return new Big(amount).times(percent).div(100).round(6, Big.roundDown).toString()
}

export function compareEth(a: EthAmount, b: EthAmount): number {
  return new Big(a).cmp(b)
}

export function isEthString(value: string): boolean {
  return /^\d+(\.\d{1,18})?$/.test(value.trim())
}

/**
 * Formats a decimal string for display without float conversion.
 * Keeps at least 2 decimals and trims trailing zeros beyond that.
 */
export function formatEth(value: EthAmount, { unit = true }: { unit?: boolean } = {}): string {
  const fixed = new Big(value).toFixed(6)
  let [int, dec = ''] = fixed.split('.')
  dec = dec.replace(/0+$/, '')
  if (dec.length < 2) dec = dec.padEnd(2, '0')
  const out = `${int}.${dec}`
  return unit ? `${out} ETH` : out
}
