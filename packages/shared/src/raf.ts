export interface RegisterRafMethods {
	/**
	 * requestAnimationFrame
	 */
	raf: AnimationFrameProvider['requestAnimationFrame']
	/**
	 * cancelAnimationFrame
	 */
	caf: AnimationFrameProvider['cancelAnimationFrame']
}

export type CancelRaf = () => void

export function registerRaf(
	handler: (time: number) => void,
	methods?: RegisterRafMethods,
): CancelRaf {
	const raf = methods?.raf ?? window.requestAnimationFrame
	const caf = methods?.caf ?? window.cancelAnimationFrame

	let handleId: number | null = raf(handler)

	return () => {
		if (handleId == null)
			return
		caf(handleId)
		handleId = null
	}
}
