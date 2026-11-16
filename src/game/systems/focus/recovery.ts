import type { CoreState } from '../../state';
import { focusRecovery } from './decide';

export function applyFocusRecovery(s: CoreState, dt: number, blocked: boolean) {
    Object.assign(s.focus, focusRecovery(s.focus, blocked, dt));
}
