import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundle = await build({ stdin: {
    contents: `export { createGame } from './src/game/game';
        export { createRenderCtx } from './src/render/context';
        export { drawBuilding } from './src/render/scene/building';`,
    resolveDir: process.cwd(),
}, bundle: true, write: false, platform: 'node', format: 'esm' });
const { createGame, createRenderCtx, drawBuilding } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function render(state, locale, width) {
    const labels = [];
    const lg = { fillText(text, x, y) { labels.push({ text, x, y, font: this.font, color: this.fillStyle }); } };
    const ctx = createRenderCtx({}, lg);
    Object.assign(ctx, { state, p: state.player, mode: state.mode, locale, t: state.time,
        cam: Math.max(0, Math.min(state.player.x - width * .35, state.level.length - width)),
        VW: width, W: width, H: 510, LEN: state.level.length, GOAL: state.level.goal,
        solids: state.solids, soaked: state.soaked, dirty: state.dirty,
    });
    drawBuilding(ctx);
    assert.ok(ctx.commands.length > 100);
    let defs = '', shapes = '';
    ctx.commands.forEach((c, i) => {
        for (const point of c.v) for (const n of point) assert.ok(Number.isFinite(n));
        for (const curve of c.curves ?? []) for (const n of curve) assert.ok(Number.isFinite(n));
        let fill = c.c;
        if (typeof fill !== 'string') {
            assert.ok(fill.stops.every(([, color]) => color.every(Number.isFinite)));
            defs += `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${fill.from[0]}" y1="${fill.from[1]}" x2="${fill.to[0]}" y2="${fill.to[1]}">${fill.stops.map(([at, [r,g,b,a]]) => `<stop offset="${at}" stop-color="rgb(${r},${g},${b})" stop-opacity="${a/255}"/>`).join('')}</linearGradient>`;
            fill = `url(#g${i})`;
        }
        const d = `M${c.v[0].join(',')} ${c.v.slice(1).map(v => `L${v.join(',')}`).join(' ')} ${(c.curves ?? []).map(v => `C${v.join(',')}`).join(' ')} Z`;
        shapes += `<path d="${d}" fill="${fill}"/>`;
    });
    for (const label of labels) {
        assert.ok(Number.isFinite(label.x) && Number.isFinite(label.y));
        shapes += `<text x="${label.x}" y="${label.y}" text-anchor="middle" style="font:${label.font};fill:${label.color}">${escape(label.text)}</text>`;
    }
    return { labels, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="510" data-player-x="${state.player.x}" data-time="${state.time}" data-cam="${ctx.cam}"><defs>${defs}</defs>${shapes}</svg>` };
}

test('window workers keep their appearance while typing and vary with the stage seed', () => {
    const game = createGame();
    game.startStage(2);
    const base = game.getSnapshot();
    const first = { ...base, corridor: { ...base.corridor, appearanceSeed: 314159 } };
    const second = { ...base, corridor: { ...base.corridor, appearanceSeed: 271828 } };
    assert.equal(render(first, 'en', 1000).svg, render(first, 'en', 1000).svg);
    assert.notEqual(render(first, 'en', 1000).svg, render(second, 'en', 1000).svg);
});

test('corridor and meeting render finite vector paths in both languages and narrow views', async () => {
    const game = createGame(); game.startStage(2);
    assert.ok(!render(game.getSnapshot(), 'en', 1000).labels.some(({ text }) => text === '↓ Enter'));
    const frames = new Map(); let visited = false;
    for (let i = 0; i < 7200; i++) {
        const state = game.getSnapshot();
        if (state.canEnterMeeting && !frames.has('entrance')) frames.set('entrance', state);
        if (state.canEnterMeeting && !visited && state.corridor.dispatchAge > 2.7) { game.interact(); visited = true; }
        if (state.corridor.dispatchAge > 1.8 && state.corridor.dispatchAge < 2.1 && !frames.has('chairs')) frames.set('chairs', state);
        if (state.corridor.room.kind === 'meeting' && state.corridor.room.age > 3.7 && !frames.has('meeting')) frames.set('meeting', state);
        if (state.player.x > 1280 && !state.corridor.scanner.approved && !frames.has('scanner')) frames.set('scanner', state);
        if (state.corridor.cart && !frames.has('cart')) {
            assert.ok(state.corridor.cart.x > state.player.x, 'delivery warning must precede the player crossing');
            frames.set('cart', state);
        }
        if (state.mode === 'won') break;
        assert.equal(state.mode, 'play');
        const waitingForMeeting = !visited && state.player.x > 510;
        const waitingForScan = !state.corridor.scanner.approved && state.player.x > 1280;
        const correction = -state.player.a * 12 - state.player.w * 4;
        game.setInput(...(waitingForMeeting ? (state.player.vx > 10 ? ['left'] : state.player.vx < -10 ? ['right'] : []) : waitingForScan ? [] : ['right']), ...(correction < -.4 ? ['q'] : correction > .4 ? ['e'] : []));
        game.step(1/120); game.drainEvents();
    }
    assert.equal(game.getSnapshot().mode, 'won');
    assert.equal(frames.size, 5);
    for (const [name, state] of frames) for (const locale of ['en', 'ko']) for (const width of [540, 1000]) {
        const frame = render(state, locale, width);
        if (name === 'entrance') assert.ok(frame.labels.some(({ text }) => text === (locale === 'en' ? '↓ Enter' : '↓ 들어가기')));
        if (locale === 'en') for (const { text } of frame.labels) assert.doesNotMatch(text, /[가-힣]/);
        for (const { text } of frame.labels) assert.doesNotMatch(text, /^(Exit|Lift shaft|Mechanical room)/);
        if (process.env.STAGE2_PREVIEW_DIR) {
            await mkdir(process.env.STAGE2_PREVIEW_DIR, { recursive: true });
            await writeFile(`${process.env.STAGE2_PREVIEW_DIR}/${name}-${locale}-${width}.svg`, frame.svg);
        }
    }
});
