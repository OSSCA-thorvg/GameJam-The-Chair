import { setActivity } from '../../src/game/state';

import type { CoreState } from '../../src/game/state';

export function checkActivityTypes(state: CoreState): void {
    if (state.mode === 'focuslost') {
        // @ts-expect-error Focus cannot recover during the failure animation.
        state.focus.value = 100;
    }
    if (state.mode === 'impact') {
        state.impact.elapsed += 1;
    }
    // @ts-expect-error A mode change must also supply its required data.
    state.mode = 'impact';
    // @ts-expect-error Loss reasons cannot change independently of the mode.
    state.lossReason = 'head';
    // @ts-expect-error Impact playback requires impact data.
    setActivity(state, { mode: 'impact', lossReason: 'head', impact: null });
    // @ts-expect-error Focus loss cannot have a head-impact reason.
    setActivity(state, { mode: 'focuslost', lossReason: 'head', impact: null });
    // @ts-expect-error A live game cannot have a loss reason.
    setActivity(state, { mode: 'play', lossReason: 'bin', impact: null });
    // @ts-expect-error Death requires a loss reason.
    setActivity(state, { mode: 'dead', lossReason: null, impact: null });
    setActivity(state, {
        mode: 'focuslost',
        lossReason: 'focus',
        impact: null,
        // @ts-expect-error Focus-loss modes require zero focus.
        focus: { ...state.focus, value: 100 },
    });
}
