const PRECISION = 1_000_000

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * PRECISION) / PRECISION
}

export function rebalanceWeights<V extends Record<string, number>, K extends keyof V & string>(
  values: V,
  changedKey: K,
  requestedValue: number,
  lockedKeys: ReadonlySet<string>,
): V {
  const keys = Object.keys(values) as Array<keyof V & string>
  const lockedPeers = keys.filter(key => key !== changedKey && lockedKeys.has(key))
  const adjustablePeers = keys.filter(key => key !== changedKey && !lockedKeys.has(key))
  const lockedTotal = lockedPeers.reduce((sum, key) => sum + values[key]!, 0)
  const capacity = Math.max(0, 1 - lockedTotal)
  const changed = adjustablePeers.length === 0
    ? capacity
    : Math.min(capacity, Math.max(0, Number.isFinite(requestedValue) ? requestedValue : values[changedKey]!))
  const remainder = Math.max(0, capacity - changed)
  const peerTotal = adjustablePeers.reduce((sum, key) => sum + Math.max(0, values[key]!), 0)
  const result: Record<string, number> = { ...values, [changedKey]: round(changed) }

  adjustablePeers.forEach((key, index) => {
    if (index === adjustablePeers.length - 1) {
      const assigned = keys.reduce((sum, item) => item === key ? sum : sum + result[item]!, 0)
      result[key] = round(Math.max(0, 1 - assigned))
    } else {
      const share = peerTotal === 0 ? 1 / adjustablePeers.length : Math.max(0, values[key]!) / peerTotal
      result[key] = round(remainder * share)
    }
  })
  return result as V
}

export function percent(value: number): string {
  const amount = Math.round(value * 1000) / 10
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)}%`
}
