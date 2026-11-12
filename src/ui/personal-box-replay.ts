import { createCursor, type Timeline } from '../game/replay';
import { createPersonalBoxObserver, type PersonalBoxReaction } from '../render/personal-box-motion';

// Keep only the few reaction transitions, so seeking past the box preserves its blank badge.
export function buildPersonalBoxTrack(timeline: Timeline) {
    const observer = createPersonalBoxObserver();
    const entries: { tick: number; reaction: PersonalBoxReaction }[] = [];
    if (timeline.file.start.stage !== 3) return entries;
    const cursor = createCursor({ ...timeline.file, endTick: timeline.endTick });
    function capture() {
        const state = cursor.state;
        observer.observe({ stage: state.stage, deaths: state.deaths, time: state.time, player: state.p });
        const reaction = observer.snapshot();
        if (entries.at(-1)?.reaction !== reaction) entries.push({ tick: state.tick, reaction });
    }
    capture();
    while (cursor.pending() !== 'end') {
        try {
            cursor.next();
        } catch {
            break; // buildTimeline has already recorded this replay's error boundary.
        }
        capture();
    }
    return entries;
}

export function personalBoxAt(entries: ReturnType<typeof buildPersonalBoxTrack>, tick: number): PersonalBoxReaction {
    let reaction: PersonalBoxReaction = { kind: 'idle' };
    for (const entry of entries) {
        if (entry.tick > tick) break;
        reaction = entry.reaction;
    }
    return reaction;
}
