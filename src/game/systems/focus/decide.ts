
export type FocusKind = 'paper' | 'water' | 'light' | 'door' | 'bump' | 'bird' | 'praise';
// One distraction. The same kind and id only ever costs focus once per attempt.
export type FocusHit = { kind: FocusKind; id: number; damage: number };
export type FocusNotice = { kind: FocusKind; life: number };
export type Focus = { focus: number; focusClock: number; focusEvents: readonly string[]; focusNotice: FocusNotice | null };

export const FOCUS_LOSS_DURATION = 1.7;

// Focus after a distraction, or null if this distraction already counted. `lost` means focus ran out.
export function focusAfterHit(f: Readonly<Focus>, hit: FocusHit): (Focus & { lost: boolean }) | null {
    const token = hit.kind + ':' + hit.id;
    if (f.focusEvents.includes(token)) return null;
    const focus = Math.max(0, f.focus - hit.damage);
    return { focus, focusClock: 0, focusEvents: [...f.focusEvents, token], focusNotice: { kind: hit.kind, life: 1.7 }, lost: focus === 0 };
}

// Focus slowly returns, one point every two undisturbed seconds.
export function focusRecovery(f: Readonly<Focus>, blocked: boolean, dt: number): Pick<Focus, 'focus' | 'focusClock' | 'focusNotice'> {
    let focusNotice = f.focusNotice ? { ...f.focusNotice, life: f.focusNotice.life - dt } : null;
    if (focusNotice && focusNotice.life <= 0) focusNotice = null;
    if (blocked || f.focus >= 100) return { focus: f.focus, focusClock: 0, focusNotice };
    let { focus, focusClock } = f;
    focusClock += dt;
    if (focusClock >= 2 - 1e-9) {
        const amount = Math.floor((focusClock + 1e-9) / 2);
        focus = Math.min(100, focus + amount);
        focusClock = Math.max(0, focusClock - amount * 2);
    }
    return { focus, focusClock, focusNotice };
}

// The rider stares at the distraction for a moment before the attempt ends.
export function focusLossStep(time: number, dt: number) {
    const next = time + dt;
    return { time: next, over: next >= FOCUS_LOSS_DURATION };
}
