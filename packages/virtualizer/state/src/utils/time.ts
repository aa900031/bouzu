const perf = window?.performance ?? null
// eslint-disable-next-line ts/ban-ts-comment
// @ts-expect-error
const perfNowFn = perf?.now ?? perf?.webkitNow ?? perf?.msNow ?? perf?.mozNow

export type GetTimeFn = () => number

export const getTime: GetTimeFn = perfNowFn
	? perfNowFn.bind(perf)
	: Date.now ?? (() => new Date().getTime())
