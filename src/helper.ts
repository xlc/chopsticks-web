export const callToHuman = (call: any) => {
  if (!call) return
  return JSON.stringify(Object.fromEntries((call.argsEntries as any).map(([k, v]: any) => [k, v.toHuman()])), null, 2)
}
