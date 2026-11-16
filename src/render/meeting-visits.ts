type MeetingInput = { stage: number; corridor?: { room: { kind: string } } };

export function createMeetingVisits() {
    let visits = 0;
    let stage: number | null = null;
    let room: string | null = null;
    return {
        observe(next: MeetingInput) {
            if (stage !== null && next.stage !== stage) {
                visits = 0;
                room = null;
            }
            stage = next.stage;
            if (!next.corridor) return;
            const kind = next.corridor.room.kind;
            if (kind === 'entering' && room !== 'entering') visits++;
            room = kind;
        },
        snapshot: () => visits,
    };
}
