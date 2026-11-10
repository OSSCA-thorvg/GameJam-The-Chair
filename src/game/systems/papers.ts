import { FOCUS_DAMAGE, LEVEL } from '../level';
import type { Paper, Point } from '../types';
import type { FocusHit } from './focus';

export type Copier = { x: number; cool: number; burst: number; next: number; dir: number };
export type CopierResult = { copier: Copier; volley: number; fire: boolean };
export type PaperHit = { index: number; vx: number; focus: FocusHit };

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
    }));
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
        if (!z.safe && !z.hit && !z.landed && !inBin && Math.hypot(z.x - p.x, z.y - (p.y - 50)) < 48) {
            z.hit = true;
            hits.push({ index, vx: z.vx, focus: { kind: 'paper', id: z.volley, damage: FOCUS_DAMAGE.copier } });
        }
        return z;
    });
    return { papers: moved, hits };
}

export function trimPapers(papers: readonly Paper[]) {
    return papers.filter(z => z.life > 0).slice(-60);
}
