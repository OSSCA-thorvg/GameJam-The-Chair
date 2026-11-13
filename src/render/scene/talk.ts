import { translate, type Message } from '../../i18n';
import { REACTION_LIFE, SPEECH_LIFE } from '../../ui/types';
import type { RenderCtx } from '../context';
import { LABEL_FONT, SPEECH_FONT } from '../fonts';
import type { SceneTalk } from '../types';
import { wrap } from './opening/bubble';
import { PathBuilder, push } from './opening/shapes';

// Words people say during play and the stage title card, as ThorVG paths and Text in canvas pixels,
// so they keep their size while the camera scales and stay in the scene's paint order.

const PAPER = '#f7ecd8ed';
const INK = '#4b493f';
const STAGE_TITLES: Record<number, Message> = {
    1: 'stageLabel.stage1', 2: 'stageLabel.stage2', 3: 'stageLabel.stage3', 4: 'stageLabel.stage4', 5: 'stageLabel.stage5',
};
const TITLE_TIME = 2.2;

const easeOutBack = (u: number) => 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2;

/** Pops in from the tail over the first moments of `age`, and fades out over the last of `life`. */
function presence(age: number, life: number) {
    return { scale: .55 + .45 * easeOutBack(Math.min(1, age / .2)), alpha: Math.min(1, life / .25, age / .08) };
}

/** A rounded speech box whose tail points down to `tip`, scaled about the tip. */
function bubblePath(x: number, y: number, w: number, h: number, tip: [number, number], scale: number) {
    const r = Math.min(9, h / 2);
    const tw = 7;
    const tailX = Math.max(x + r + tw, Math.min(x + w - r - tw, tip[0]));
    const s = (px: number, py: number): [number, number] => [tip[0] + (px - tip[0]) * scale, tip[1] + (py - tip[1]) * scale];
    return new PathBuilder(...s(x + r, y))
        .line(...s(x + w - r, y)).corner(...s(x + w, y), ...s(x + w, y + r))
        .line(...s(x + w, y + h - r)).corner(...s(x + w, y + h), ...s(x + w - r, y + h))
        .line(...s(tailX + tw, y + h)).line(...tip).line(...s(tailX - tw, y + h))
        .line(...s(x + r, y + h)).corner(...s(x, y + h), ...s(x, y + h - r))
        .line(...s(x, y + r)).corner(...s(x, y), ...s(x + r, y));
}

type Line = { text: string; size: number; color: string };

/** A paper bubble holding `lines`, its tail at canvas x `tipX`, its bottom at canvas y `bottom`. */
function speechBubble(ctx: RenderCtx, key: string, lines: Line[], tipX: number, bottom: number, age: number, life: number) {
    const { scale, alpha } = presence(age, life);
    if (alpha <= 0) return;
    const padX = 13, padY = 8;
    const widths = lines.map(line => ctx.measureText(line.text, line.size, SPEECH_FONT));
    const heights = lines.map(line => line.size * 1.35);
    const w = Math.max(...widths) + padX * 2;
    const h = heights.reduce((a, b) => a + b, 0) + padY * 2;
    const x = ctx.clamp(tipX - w / 2, 10, Math.max(10, ctx.W - 10 - w));
    const y = bottom - h;
    const tip: [number, number] = [ctx.clamp(tipX, x + 12, x + w - 12), bottom + 8];
    ctx.beginLayer({ key, opacity: alpha });
    push(ctx, bubblePath(x, y, w, h, tip, scale).command(PAPER));
    ctx.endLayer();
    let lineY = y + padY;
    lines.forEach((line, i) => {
        const [cx, cy] = [tip[0] + (x + w / 2 - tip[0]) * scale, tip[1] + (lineY + heights[i] / 2 - tip[1]) * scale];
        ctx.screenText(line.text, cx, cy, line.size * scale, line.color, { font: SPEECH_FONT, opacity: alpha });
        lineY += heights[i];
    });
}

/** The rider's reaction over the chair, and outside stage 2 a colleague's remark at the floor line. */
export function drawTalk(ctx: RenderCtx, talk: SceneTalk) {
    const { state, mode, cam, scale, vertical } = ctx;
    const size = ctx.W < 520 ? 13 : 15;
    const reaction = talk.reaction;
    if (mode === 'play' && state.stage !== 2 && reaction) {
        const lines = wrap(text => ctx.measureText(text, size, SPEECH_FONT), reaction.text, ctx.W * .8)
            .map(text => ({ text, size, color: INK }));
        const bottom = Math.max(110, (ctx.p.y - 110 + vertical) * scale) - 8;
        speechBubble(ctx, 'talk-reaction', lines, (ctx.p.x - cam) * scale, bottom, REACTION_LIFE - reaction.life, reaction.life);
    }
    const speech = talk.speech;
    const speechX = speech ? (speech.x - cam) * scale : 0;
    if (speech && state.stage === 1 && ['play', 'impact', 'dead'].includes(mode) && speechX > 0 && speechX < ctx.W) {
        const lines = [
            { text: speech.name, size: size - 4, color: '#77705e' },
            ...wrap(text => ctx.measureText(text, size, SPEECH_FONT), speech.text, ctx.W - 40).map(text => ({ text, size, color: INK })),
        ];
        const bottom = (mode === 'dead' ? 105 : Math.max(110, (ctx.F - 177 + vertical) * scale)) - 8;
        speechBubble(ctx, 'talk-speech', lines, speechX, bottom, SPEECH_LIFE - speech.life, speech.life);
    }
}

/** The stage's name drops in at the top, bounces once, and slips away. */
export function drawStageTitle(ctx: RenderCtx) {
    const t = ctx.state.time;
    if (ctx.mode !== 'play' || t > TITLE_TIME) return;
    const text = translate(STAGE_TITLES[ctx.state.stage] ?? 'stageLabel.stage1', ctx.locale);
    const size = ctx.W < 520 ? 14 : 17;
    const w = ctx.measureText(text, size, LABEL_FONT) + 34, h = size + 18;
    const drop = easeOutBack(Math.min(1, t / .45));
    const alpha = Math.min(1, t / .12, (TITLE_TIME - t) / .3);
    const cx = ctx.W / 2, cy = (ctx.W < 520 ? 68 : 70) + h / 2 - (1 - drop) * 50;
    const tilt = Math.sin(t * 9) * Math.max(0, .6 - t) * .08;
    const corner = (dx: number, dy: number): [number, number] => [cx + dx * Math.cos(tilt) - dy * Math.sin(tilt), cy + dx * Math.sin(tilt) + dy * Math.cos(tilt)];
    const r = 7, hw = w / 2, hh = h / 2;
    const card = new PathBuilder(...corner(-hw + r, -hh))
        .line(...corner(hw - r, -hh)).corner(...corner(hw, -hh), ...corner(hw, -hh + r))
        .line(...corner(hw, hh - r)).corner(...corner(hw, hh), ...corner(hw - r, hh))
        .line(...corner(-hw + r, hh)).corner(...corner(-hw, hh), ...corner(-hw, hh - r))
        .line(...corner(-hw, -hh + r)).corner(...corner(-hw, -hh), ...corner(-hw + r, -hh));
    ctx.beginLayer({ key: 'stage-title', opacity: alpha });
    push(ctx, card.command('#28303bdc', { width: 1.5, color: '#f6eddc33' }));
    ctx.endLayer();
    ctx.screenText(text, cx, cy, size, '#f6eddc', { font: LABEL_FONT, opacity: alpha, rotation: tilt });
}
