import type { ValueOf } from 'type-fest'

export const TruncateCollapseDirection = {
	Start: 'start',
	End: 'end',
} as const

export type TruncateCollapseDirectionValues = ValueOf<typeof TruncateCollapseDirection>
