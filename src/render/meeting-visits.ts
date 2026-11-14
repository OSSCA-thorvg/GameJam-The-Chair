/** What the visit counter needs from a frame; the corridor is missing from the per-step observation. */
type MeetingInput = { stage: number; corridor?: { room: { kind: string } } };

/**
 * Counts how many times the player has walked into the stage two meeting room, so its chairs can say something
 * new on each visit. Presentation only: it watches snapshots, the game never reads it, and a new stage resets it.
 */
export function createMeetingVisits() {
    let visits = 0;
    let stage: number | null = null;
    let room: string | null = null;
    return {
        observe(next: MeetingInput) {
            if (stage !== null && next.stage !== stage) { visits = 0; room = null; }
            stage = next.stage;
            if (!next.corridor) return;
            const kind = next.corridor.room.kind;
            if (kind === 'entering' && room !== 'entering') visits++;
            room = kind;
        },
        snapshot: () => visits,
    };
}
