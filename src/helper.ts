import { type Block, decodeBlockStorageDiff } from '@acala-network/chopsticks-core'
import { create } from 'jsondiffpatch'
import _ from 'lodash'

export const callToHuman = (call: any) => {
  if (!call) return
  return JSON.stringify(Object.fromEntries((call.argsEntries as any).map(([k, v]: any) => [k, v.toHuman()])), null, 2)
}

const diffPatcher = create({
  arrays: { detectMove: false },
  textDiff: { minLength: Number.MAX_VALUE } as any, // skip text diff
})

export const decodeStorageDiff = async (block: Block, diff: [string, string | null][]) => {
  const [oldState, newState] = await decodeBlockStorageDiff(block, diff as any)
  const oldStateWithoutEvents = _.cloneDeep(oldState) as any
  if (oldStateWithoutEvents.system?.events) {
    oldStateWithoutEvents.system.events = []
  }
  return { oldState, newState, delta: diffPatcher.diff(oldStateWithoutEvents, newState) }
}
