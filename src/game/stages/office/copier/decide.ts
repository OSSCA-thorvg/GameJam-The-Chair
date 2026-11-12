import { FOCUS_DAMAGE, LEVEL } from '../../../level';
import type { Paper, Point } from '../../../types';
import type { FocusHit } from '../../../systems/focus/decide';

export type Copier = { x: number; cool: number; burst: number; next: number; dir: number };
export type CopierResult = { copier: Copier; volley: number; fire: boolean };
export type PaperHit = { index: number; vx: number; heavy: boolean; focus: FocusHit };

// The office copier wakes when the chair comes near, aims, and fires bursts of four sheets.
export function copierStep(copier: Readonly<Copier>, volley: number, playerX: number, office: boolean, dt: number): CopierResult {
    const next = { ...copier };
    let fire = false;
    if (office && (volley > 0 || Math.abs(playerX - next.x) < 350) && next.cool === 0 && next.burst === 0) {
        next.dir = playerX < next.x ? -1 : 1;
        volley++;
        next.burst = 4;
        next.next = .75;
        next.cool = 1.45;
    }
    if (next.burst > 0) {
        next.next -= dt;
        if (next.next <= 0) {
            fire = true;
            next.burst--;
            next.next = .19;
        }
    }
    return { copier: next, volley, fire };
}

// One shot of four sheets. The very first shot of the first volley is harmless, to teach the hazard.
export function paperShot(copier: Readonly<Copier>, volley: number, bursts: number): Paper[] {
    const F = LEVEL.floor;
    const dir = copier.dir;
    return [0, 1, 2, 3].map(i => ({
        x: copier.x + dir * 48,
        y: F - 90 - i * 4,
        vx: dir * (200 + i * 24),
        vy: -60 - i * 27,
        a: i * .8,
        w: dir * (3 + i),
        life: 5,
        hit: false,
        landed: false,
        volley,
        safe: volley === 1 && bursts === 0,
        kind: 'sheet' as const,
    }));
}

// The executive printer's urgent-report mode. `scan` counts down the warning sweep before a volley,
// `burst` the shots left in it; `volley` counts urgent volleys and picks the pattern.
export type UrgentCopier = { x: number; scan: number; cool: number; burst: number; next: number; dir: number; volley: number };
export type UrgentPattern = 'low' | 'lob' | 'fan' | 'bundle';
export type UrgentResult = { copier: UrgentCopier; fire: boolean; started: boolean };

// A fixed order to learn: skimming sheets (jump), lobbed sheets (wait or dash), both at once, a heavy
// bundle; then the last two take turns.
export function urgentPattern(volley: number): UrgentPattern {
    const order: UrgentPattern[] = ['low', 'lob', 'fan', 'bundle'];
    return volley <= order.length ? order[Math.max(0, volley - 1)] : order[2 + (volley - order.length - 1) % 2];
}
const URGENT_SHOTS: Record<UrgentPattern, number> = { low: 5, lob: 4, fan: 5, bundle: 4 };
// Urgent sheets carry their own focus id from here up (volley * 100 + shot * 10 + sheet), so each sheet
// that hits counts, apart from the office copier's once-per-volley hits.
export const URGENT_VOLLEY_ID = 1000;

export function createUrgentCopier(): UrgentCopier {
    return { x: LEVEL.urgentCopier.x, scan: 0, cool: 0, burst: 0, next: 0, dir: -1, volley: 0 };
}

// Wakes while the chair is near, scans (the warning), then fires the volley's pattern and rests.
export function urgentCopierStep(copier: Readonly<UrgentCopier>, playerX: number, dt: number): UrgentResult {
    const spec = LEVEL.urgentCopier;
    const next = { ...copier, cool: Math.max(0, copier.cool - dt) };
    let fire = false, started = false;
    if (next.scan === 0 && next.burst === 0 && next.cool === 0 && Math.abs(playerX - next.x) < spec.wake) {
        next.dir = playerX < next.x ? -1 : 1;
        next.volley++;
        next.scan = spec.scan;
        started = true;
    } else if (next.scan > 0) {
        next.scan = Math.max(0, next.scan - dt);
        if (next.scan === 0) {
            next.burst = URGENT_SHOTS[urgentPattern(next.volley)];
            next.next = 0;
        }
    }
    if (next.burst > 0 && next.scan === 0) {
        next.next -= dt;
        if (next.next <= 0) {
            fire = true;
            next.burst--;
            next.next = spec.shotGap;
            if (next.burst === 0) next.cool = spec.rest;
        }
    }
    return { copier: next, fire, started };
}

// The urgent shot just fired by `copier` (its `burst` already counts it out).
export function urgentShot(copier: Readonly<UrgentCopier>): Paper[] {
    const F = LEVEL.floor;
    const dir = copier.dir;
    const pattern = urgentPattern(copier.volley);
    const shot = URGENT_SHOTS[pattern] - 1 - copier.burst;
    const sheet = (y: number, vx: number, vy: number, i: number, kind: Paper['kind'] = 'sheet'): Paper => ({
        x: copier.x + dir * 60, y, vx: dir * vx, vy, a: i * .7, w: dir * (kind === 'bundle' ? 1.5 : 4 + i),
        life: LEVEL.urgentCopier.life, hit: false, landed: false, safe: false, kind,
        volley: URGENT_VOLLEY_ID + copier.volley * 100 + shot * 10 + i,
    });
    // Skimming just above the floor: only a jump clears them.
    // Each later shot of a volley flies a little faster, so the stream spreads out instead of stacking.
    const low = () => [0, 1, 2, 3].map(i => sheet(F - 38 - i * 3, 285 + i * 22 + (shot % 3) * 15, -70 - i * 6, i));
    // Lobbed high, raining down a little ahead of the printer.
    const lob = (count: number) => Array.from({ length: count }, (_, i) => sheet(F - 120, 130 + i * 40 + (shot % 3) * 25, -230 - i * 18, i));
    // 20 sheets' worth each: low 5×4, lob 4×5, fan low/lob alternating 5×4, bundle (8) + 3×4 loose pages.
    if (pattern === 'low') return low();
    if (pattern === 'lob') return lob(5);
    if (pattern === 'fan') return shot % 2 === 1 ? lob(4) : low();
    return shot === 0 ? [sheet(F - 55, 230, -90, 0, 'bundle')] : lob(4);
}

// Moves every sheet one step and reports the ones that hit the rider, in order.
// The returned list is not yet trimmed so a caller that stops at a hit can keep the rest unmoved.
export function papersStep(papers: readonly Readonly<Paper>[], p: Readonly<Point>, inBin: boolean, dt: number): { papers: Paper[]; hits: PaperHit[] } {
    const F = LEVEL.floor;
    const hits: PaperHit[] = [];
    const moved = papers.map((paper, index) => {
        const z = { ...paper };
        z.life -= dt;
        z.x += z.vx * dt;
        z.y += z.vy * dt;
        z.vx *= Math.exp(-.8 * dt);
        z.vy += 210 * dt;
        z.a += z.w * dt;
        const pit = z.x > LEVEL.bin.a && z.x < LEVEL.bin.b;
        if (z.y > F - 4 && !pit) {
            z.y = F - 4;
            z.vy = 0;
            z.vx *= Math.exp(-4 * dt);
            z.w *= .9;
            z.landed = true;
        }
        const heavy = z.kind === 'bundle';
        if (!z.safe && !z.hit && !z.landed && !inBin && Math.hypot(z.x - p.x, z.y - (p.y - 50)) < (heavy ? 60 : 48)) {
            z.hit = true;
            const damage = heavy ? FOCUS_DAMAGE.bundle : z.volley >= URGENT_VOLLEY_ID ? FOCUS_DAMAGE.urgentSheet : FOCUS_DAMAGE.copier;
            hits.push({ index, vx: z.vx, heavy, focus: { kind: 'paper', id: z.volley, damage } });
        }
        return z;
    });
    return { papers: moved, hits };
}

export function trimPapers(papers: readonly Paper[]) {
    return papers.filter(z => z.life > 0).slice(-60);
}
