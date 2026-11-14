import type { RenderCtx } from '../context';
import type { Vector } from '../types';
import { SPEECH_FONT } from '../fonts';

/** What the rider blurts out each second he is caught in the light: yes, done, and a tired sigh, in turn. */
const MARKS = ['!', '✓', '…'];

/**
 * A small speech bubble beside the rider's head with one mark in it, while the chair is in a beam. Each focus hit
 * (one per second of `age`) pops up the next mark. No words: the rider just answers the camera.
 */
export function orbitReaction(ctx: RenderCtx, head: Vector, age: number, lit: boolean) {
    if (!lit) return;
    const beat = age - Math.floor(age), mark = MARKS[Math.floor(age) % MARKS.length];
    const pop = beat < .12 ? .6 + .4 * (beat / .12) * (1 + .3 * Math.sin(beat / .12 * Math.PI)) : 1;
    const size = ctx.clamp(ctx.H * .05, 16, 28) * pop;
    const cx = head[0] + size * 1.6, cy = head[1] - size * 1.4, rx = size * .95, ry = size * .8;
    const ellipse = Array.from({ length: 20 }, (_, i): Vector => [cx + rx * Math.cos(i * Math.PI / 10), cy + ry * Math.sin(i * Math.PI / 10)]);
    const layer = { key: 'orbit-reaction' };
    ctx.commands.push({ v: [[cx - rx * .55, cy + ry * .55], [cx - rx * 1.25, cy + ry * 1.45], [cx - rx * .1, cy + ry * .85]], c: '#ffffff', stroke: { width: 2, color: '#2b2f3a' }, layer });
    ctx.commands.push({ v: ellipse, c: '#ffffff', stroke: { width: 2, color: '#2b2f3a' }, layer });
    ctx.screenText(mark, cx, cy + size * .04, size * 1.05, '#2b2f3a', { font: SPEECH_FONT });
}
