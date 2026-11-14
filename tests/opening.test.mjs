import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createOpening, createRenderCtx, drawOpening, openingFrame, openingState, OPENING_BEATS, OPENING_DURATION, translate, previewScenes } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createOpening } from './src/ui/opening';
    export { createRenderCtx } from './src/render/context';
    export { drawOpening, openingFrame, openingState, OPENING_BEATS, OPENING_DURATION } from './src/render/scene/opening';
    export { translate } from './src/i18n';
    export { previewScenes } from './src/preview-scenes';
`);
const B = OPENING_BEATS;

test('the opening plays once per page load after either a skip or a full run', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const scene = { append() {} };
    globalThis.window = { addEventListener() {} };
    globalThis.document = { createElement: () => ({
        setAttribute() {}, append() {}, addEventListener() {}, focus() {}, remove() {},
    }) };
    const root = { querySelector: () => scene };

    try {
        const skipped = createOpening(root, () => 'en');
        assert.equal(skipped.seen, false);
        let finished = 0;
        skipped.start(() => finished++);
        assert.equal(skipped.active, true);
        skipped.skip();
        assert.equal(finished, 1);
        assert.equal(skipped.seen, true);
        skipped.destroy();

        const reloaded = createOpening(root, () => 'en');
        assert.equal(reloaded.seen, false);
        reloaded.start(() => finished++);
        reloaded.advance(OPENING_DURATION);
        assert.equal(finished, 2);
        assert.equal(reloaded.seen, true);
        reloaded.destroy();

        const nextLoad = createOpening(root, () => 'en');
        assert.equal(nextLoad.seen, false);
        nextLoad.destroy();
    } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
    }
});

function render(time, locale = 'ko') {
    const ctx = createRenderCtx({});
    const game = createGame();
    game.reset();
    const frame = openingFrame(time);
    const state = openingState(game.getSnapshot(), frame);
    Object.assign(ctx, {
        state, p: state.player, mode: state.mode, locale, t: state.time, W: 800, H: 510, VW: 800 / frame.zoom, scale: frame.zoom,
        cam: state.player.x - 400 / frame.zoom, vertical: 0, LEN: state.level.length, GOAL: state.level.goal,
        solids: state.solids, people: state.people, cleaning: state.cleaning, bin: { ...state.bin, bottom: 520 },
        copier: { ...state.copier, flash: 0 }, papers: state.papers, monitors: [], urgentCopier: state.urgentCopier,
    });
    drawOpening(ctx, frame);
    for (const cmd of ctx.commands) {
        for (const point of cmd.v) for (const n of point) assert.ok(Number.isFinite(n), `finite point at t=${time}`);
        for (const curve of cmd.curves ?? []) for (const n of curve) assert.ok(Number.isFinite(n), `finite curve at t=${time}`);
    }
    const labels = ctx.commands.filter(cmd => cmd.text).map(({ text }) => ({ text: text.content, x: text.x, y: text.y, alpha: text.opacity ?? 1 }));
    return { frame, commands: ctx.commands, labels };
}

test('the clock walks from 6 pm to 9 pm and never runs backwards', () => {
    assert.equal(openingFrame(B.sixPm).hours, 18);
    assert.equal(openingFrame(B.sevenPm).hours, 19);
    assert.equal(openingFrame(B.eightPm).hours, 20);
    assert.equal(openingFrame(B.ninePm).hours, 21);
    let last = 0;
    for (let t = 0; t <= OPENING_DURATION; t += 1 / 60) {
        const { hours } = openingFrame(t);
        assert.ok(hours >= last, `clock went back at ${t}`);
        last = hours;
    }
    assert.ok(openingFrame((B.spinToEight + B.eightPm) / 2).spin > .9);
    assert.equal(openingFrame(B.sevenPm + .1).spin, 0);
});

test('beats switch between the clock and the office in the planned order', () => {
    assert.equal(openingFrame(.5).shot, 'clock');
    assert.equal(openingFrame(B.irisOpen + .3).shot, 'office');
    assert.ok(openingFrame(B.irisOpen + .3).iris > 0);
    assert.equal(openingFrame(B.riderOvertime + .1).iris, null);
    assert.equal(openingFrame(B.chairHope + .5).zoom, openingFrame(B.rage).zoom);
    assert.ok(openingFrame(B.chairHope + .5).zoom > openingFrame(B.riderSales).zoom * 2);
    assert.equal(openingFrame(B.spinToNine).shot, 'clock');
    assert.equal(openingFrame(B.rage + .5).shot, 'office');
    assert.equal(openingFrame(B.rage + .5).dusk, 1);
    assert.equal(openingFrame(OPENING_DURATION).handoff, 1);
    assert.equal(openingFrame(OPENING_DURATION).lighting, 0);
    assert.equal(openingFrame(OPENING_DURATION).done, true);
    assert.equal(openingFrame(OPENING_DURATION - .01).done, false);
});

test('the worker talks first, the chair hopes, then the chair snaps while the worker keeps typing', () => {
    const said = t => openingFrame(t).bubbles.map(b => `${b.speaker}:${b.style}:${b.message}`);
    assert.deepEqual(said(B.riderOvertime + .5), ['rider:solid:opening.riderOvertime']);
    assert.deepEqual(said(B.riderSales + .5), ['rider:solid:opening.riderSales']);
    assert.deepEqual(said(B.chairHope + 1), ['chair:glass:opening.chairHope']);
    assert.deepEqual(said(B.riderTyping + .5), ['chair:rage:opening.chairRage', 'rider:solid:opening.riderTyping']);
    assert.deepEqual(said(1), []);
    assert.deepEqual(said(B.spinToNine), []);
    for (const t of [B.riderOvertime, B.chairHope + .1, B.rage]) {
        for (const bubble of openingFrame(t + 1).bubbles) {
            for (const locale of ['en', 'ko']) assert.ok(translate(bubble.message, locale).length > 0);
        }
    }
    assert.ok(openingFrame(B.chairHope + 1).hum > .9);
    assert.ok(openingFrame(B.rage + 1).rage > .9);
});

test('7 pm the chair creaks harder and faster; 8 pm the backrest bucks the worker', () => {
    const at = t => openingFrame(t);
    for (const t of [B.creak + 1, B.kick + .5]) assert.equal(at(t).shot, 'office');
    assert.equal(at(B.spinToEight + .5).shot, 'clock');
    assert.equal(at(B.creak + 1).zoom, at(B.rage).zoom, 'both are close-ups on the chair');
    // The loudest creak late in the hour is harder than the loudest early on.
    const loudest = (from, to) => Math.max(...Array.from({ length: 120 }, (_, i) => at(from + (to - from) * i / 120).creakPulse));
    assert.ok(loudest(B.creakClose - 1.2, B.creakClose - .2) > loudest(B.creak, B.creak + 1) + .2);
    assert.equal(at(B.kick - .1).chair.backrest, 0);
    assert.ok(at(B.kick + .17).chair.backrest < -.4, 'the backrest leans back');
    assert.ok(Math.max(...Array.from({ length: 60 }, (_, i) => at(B.kick + .3 + i / 100).chair.riderPop)) > 20, 'the worker is thrown up');
    assert.ok(at(B.kick + 2).bubbles.some(b => b.message === 'opening.riderTyping'), 'and he types on');
    const kick = render(B.kick + .5);
    assert.ok(!kick.commands.some(c => c.layer?.key === 'opening-anger'), 'no anger marks at 8 pm');
    for (const t of [B.riderOvertime + 1, B.chairHope + 1, B.creak + 1, B.kick + .5]) {
        assert.ok(!render(t).commands.some(c => !c.text && c.stroke && typeof c.c === 'string' && c.c.startsWith('#f4f1ea')), `no keycap hints in the film at ${t}`);
    }
});

test('the cutscene state only poses the chair; the core snapshot is untouched', () => {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const copy = structuredClone(base);
    const posed = openingState(base, openingFrame(B.rage + .3));
    assert.deepEqual(base, copy);
    assert.equal(posed.player.x, base.player.x);
    assert.equal(posed.time, B.rage + .3);
});

test('clock frames use ThorVG masks, trims, clips and blur', () => {
    const iris = render(B.irisOpen + .4);
    const masked = iris.commands.filter(c => c.layer?.mask && c.layer.maskInvert);
    assert.ok(masked.length > 20, 'the clock cover is cut by an inverted mask');
    assert.ok(iris.commands.some(c => !c.layer), 'the office shows under the cover');

    const spin = render((B.spinToNine + B.ninePm) / 2);
    assert.ok(spin.commands.some(c => c.trim && c.stroke), 'minute trail is a trimmed stroke');
    assert.ok(spin.commands.some(c => c.layer?.key === 'opening-clock-ghost' && c.layer.blur > 0));
    assert.ok(spin.commands.some(c => c.layer?.clip), 'window view is clipped');
    assert.equal(spin.labels.length, 0, 'no words on the clock');
});

test('office frames light the scene and draw the bubbles with their words', () => {
    const wide = render(B.riderOvertime + 1.5);
    assert.ok(wide.commands.some(c => c.layer?.key === 'opening-dusk' && c.layer.blend === 'multiply'));
    assert.ok(wide.commands.some(c => c.layer?.key === 'opening-sunbeams' && c.layer.blend === 'screen'));
    assert.ok(wide.labels.some(l => l.text === translate('opening.riderOvertime', 'ko').replace('…', '...')));

    const hope = render(B.chairHope + 2.5);
    const chairBubble = hope.commands.find(c => c.layer?.key === 'opening-bubble-0' && !c.text && c.stroke);
    const riderBubble = wide.commands.find(c => c.layer?.key === 'opening-bubble-0' && !c.text && c.stroke);
    assert.notEqual(chairBubble.c, riderBubble.c, 'the chair and the worker have bubbles of their own colour');
    assert.ok(hope.commands.some(c => c.layer?.key.endsWith('-glow') && c.layer.blur > 0), 'the chair bubble glows');
    assert.ok(hope.commands.some(c => c.layer?.key === 'opening-notes'));
    assert.ok(hope.commands.some(c => c.layer?.key.endsWith('-note')), 'the chair hums a drawn note in place of the missing ♪ glyph');
    assert.ok(hope.labels.every(l => !l.text.includes('♪')));

    const rage = render(B.riderTyping + 1);
    assert.ok(rage.commands.some(c => c.layer?.key === 'opening-laptop' && c.layer.blend === 'add'));
    assert.ok(!rage.commands.some(c => c.layer?.key === 'opening-rage' && c.stroke?.dash), 'no dashed lines round the chair');
    assert.ok(rage.commands.some(c => c.layer?.key === 'opening-chair-afterimage'), 'the chair trembles in afterimages');
    assert.ok(rage.commands.some(c => c.layer?.key === 'opening-floor-dust'), 'dust jumps off the floor');
    assert.ok(!render(B.chairHope + 1).commands.some(c => c.layer?.key === 'opening-chair-afterimage'), 'calm before 9 pm');
    const words = rage.labels.map(l => l.text).join(' ');
    assert.ok(words.includes(translate('opening.riderTyping', 'ko')));
    assert.ok(words.includes('극악무도'), 'the rage line has typed out');
});

test('the opening preview is registered and seeks deterministically', () => {
    const scene = previewScenes.find(scene => scene.id === 'opening');
    assert.ok(scene);
    assert.equal(scene.duration, OPENING_DURATION);
    assert.ok(scene.markers.some(marker => marker.at === B.rage));
    const at = scene.sample(B.chairHope + 1);
    scene.sample(0);
    assert.deepEqual(scene.sample(B.chairHope + 1), at);
    assert.deepEqual(scene.opening(B.rage), openingFrame(B.rage));
});
