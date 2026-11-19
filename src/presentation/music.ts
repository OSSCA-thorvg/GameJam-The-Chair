import type { GameSnapshot } from '../game/game';

export type MusicTrack =
    'start' | 'stage1-2' | 'stage3' | 'stage4' | 'stage5' | 'ending';

const STAGE_TRACKS = {
    1: 'stage1-2',
    2: 'stage1-2',
    3: 'stage3',
    4: 'stage4',
    5: 'stage5',
} as const satisfies Record<GameSnapshot['stage'], MusicTrack>;

export function musicTrack(
    state: Pick<GameSnapshot, 'mode' | 'stage' | 'orbit'>,
    title: boolean,
): MusicTrack {
    if (title || state.mode === 'intro') {
        return 'start';
    }
    if (state.stage === 5 && state.orbit?.phase === 'parked') {
        return 'ending';
    }
    return STAGE_TRACKS[state.stage];
}
