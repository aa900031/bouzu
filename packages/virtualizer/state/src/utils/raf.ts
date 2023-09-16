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

const DEFAULT_REGISTER_RAF_METHODS: RegisterRafMethods = {
	raf: (cb: any) => window.requestAnimationFrame(cb),
	caf: (id: number) => window.cancelAnimationFrame(id),
}

export type CancelRaf = () => void

export function registerRaf(handler: (time: number) => void,
	methods: RegisterRafMethods = DEFAULT_REGISTER_RAF_METHODS): CancelRaf {
	let handleId: number | null = methods.raf(handler)

	return () => {
		if (handleId == null)
			return
		methods.caf(handleId)
		handleId = null
	}
}
