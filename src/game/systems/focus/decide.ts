export type FocusKind =
    | 'paper'
    | 'water'
    | 'light'
    | 'door'
    | 'bump'
    | 'bird'
    | 'gear'
    | 'steam'
    | 'satelliteLight';
export type FocusHit = { kind: FocusKind; id: number; damage: number };
export type FocusNotice = { kind: FocusKind; life: number };
export type FocusState = {
    value: number;
    recoveryClock: number;
    processedEvents: string[];
    notice: FocusNotice | null;
};

export const FOCUS_LOSS_DURATION = 1.7;

export function focusAfterHit(
    f: Readonly<FocusState>,
    hit: FocusHit,
): (FocusState & { lost: boolean }) | null {
    const token = hit.kind + ':' + hit.id;
    if (f.processedEvents.includes(token)) return null;
    const value = Math.max(0, f.value - hit.damage);
    return {
        value,
        recoveryClock: 0,
        processedEvents: [...f.processedEvents, token],
        notice: { kind: hit.kind, life: 1.7 },
        lost: value === 0,
    };
}

export function focusRecovery(
    f: Readonly<FocusState>,
    blocked: boolean,
    dt: number,
): Pick<FocusState, 'value' | 'recoveryClock' | 'notice'> {
    let notice = f.notice ? { ...f.notice, life: f.notice.life - dt } : null;
    if (notice && notice.life <= 0) notice = null;
    if (blocked || f.value >= 100) {
        return { value: f.value, recoveryClock: 0, notice };
    }
    let { value, recoveryClock } = f;
    recoveryClock += dt;
    if (recoveryClock >= 2 - 1e-9) {
        const amount = Math.floor((recoveryClock + 1e-9) / 2);
        value = Math.min(100, value + amount);
        recoveryClock = Math.max(0, recoveryClock - amount * 2);
    }
    return { value, recoveryClock, notice };
}

export function focusLossStep(time: number, dt: number) {
    const next = time + dt;
    return { time: next, over: next >= FOCUS_LOSS_DURATION };
}
