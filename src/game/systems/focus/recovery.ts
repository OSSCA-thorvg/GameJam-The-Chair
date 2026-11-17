import { focusRecovery } from './decide';

import type { CoreState } from '../../state';

export function applyFocusRecovery(
    s: CoreState,
    dt: number,
    blocked: boolean,
): void {
    Object.assign(s.focus, focusRecovery(s.focus, blocked, dt));
}
