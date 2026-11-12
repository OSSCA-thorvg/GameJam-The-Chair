import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './support/harness.mjs';
import { bundled } from './support/load.mjs';

const { createEffects, EFFECT_STYLE, createFeedback, createHud, createRenderer, ART } = await bundled({
    stdin: { contents: `
        export { createEffects, EFFECT_STYLE } from './src/render/effects';
        export { createFeedback } from './src/ui/feedback';
        export { createHud } from './src/ui/hud';
        export { createRenderer } from './src/render/renderer';
        export { ART } from './src/render/art';
    `, resolveDir: process.cwd() },
    plugins: [{
        name: 'headless-thorvg',
        setup(build) {
            build.onLoad({ filter: /\/render\/thorvg\.ts$/ }, () => ({
                contents: "export const loadThorvg = () => Promise.reject(new Error('Exercise Canvas2D fallback'));",
                loader: 'js',
            }));
        },
    }],
});
function applyInput(game, scenario, i) {
    const keys = scenario.kind === 'camp' && game.status().mode === 'play' && game.getSnapshot().player.x >= 490 ? [] : ['right'];
    game.setInput(...keys);
    if (scenario.kind === 'jump' && i % scenario.interval === 0) game.jump();
}

// Gameplay fingerprints live in golden.test.mjs; this suite checks presentation isolation.
test('changing effect durations and particle count cannot change gameplay', () => {
    const plain = createGame(), decorated = createGame();
    const effects = createEffects(), feedback = createFeedback();
    const saved = { ...EFFECT_STYLE };
    Object.assign(EFFECT_STYLE, { paperDuration: 1000, glareDuration: 1000, splashCount: 0, speckColor: '#ff0000' });
    try {
        plain.reset(); decorated.reset();
        const scenario = { kind: 'forward', ticks: 2400 };
        for (let i = 0; i < scenario.ticks; i++) {
            applyInput(plain, scenario, i); applyInput(decorated, scenario, i);
            plain.step(1 / 120); decorated.step(1 / 120);
            const state = decorated.getSnapshot();
            for (const event of decorated.drainEvents()) {
                effects.receive(event); feedback.receive(event, state);
            }
            plain.drainEvents();
            assert.equal(decorated.serialize(), plain.serialize());
        }
        assert.equal(effects.snapshot().waterDrops.length, 0);
        assert.ok(effects.snapshot().paperFace > 900);
        assert.ok(decorated.getSnapshot().paperPenaltyRemaining < 2.4);
    } finally { Object.assign(EFFECT_STYLE, saved); }
});

test('snapshots and event payloads do not expose live gameplay objects', () => {
    const game = createGame(); game.reset();
    const before = game.getSnapshot();
    const copy = game.getSnapshot();
    copy.player.x = 99999; copy.cleaning.a = -100; copy.solids[0].p[0].y = -100;
    copy.monitors[0].wall = 0; copy.people.length = 0;
    assert.deepEqual(game.getSnapshot(), before);
    for (let i = 0; i < 300; i++) { game.setInput('right'); game.step(1 / 120); }
    const state = game.getSnapshot();
    for (const event of game.drainEvents()) if (event.person) event.person.x = -999;
    assert.deepEqual(game.getSnapshot(), state);
});

test('HUD can be removed or replaced without affecting simulation', () => {
    const hud = createHud({ querySelector: () => null });
    const feedback = createFeedback(), effects = createEffects(), game = createGame();
    game.reset();
    for (let i = 0; i < 120; i++) {
        game.step(1 / 120);
        const state = game.getSnapshot();
        for (const event of game.drainEvents()) { effects.receive(event); feedback.receive(event, state); }
        hud.draw(state, feedback.snapshot(), effects.snapshot(), { cam:0, scale:1, vertical:0, width:800 }, 'canvas2d');
    }
    assert.equal(game.getSnapshot().mode, 'play');
});

test('fixed-step simulation is independent of render frequency', () => {
    const fast = createGame(), slow = createGame();
    fast.reset(); slow.reset(); fast.setInput('right'); slow.setInput('right');
    // Exact multiples of the physics interval avoid introducing floating point boundary differences.
    for (let i = 0; i < 120; i++) fast.advance(1 / 120);
    for (let i = 0; i < 30; i++) slow.advance(4 / 120);
    assert.equal(fast.serialize(), slow.serialize());
});

test('pause, restart and focus-loss/impact progression remain headless', () => {
    const game = createGame({ progress: { deaths: 3 } }); game.reset(); game.setInput('right');
    game.advance(.5); game.pause(); const paused = game.getSnapshot();
    game.advance(10); assert.deepEqual(game.getSnapshot(), paused);
    game.pause(); game.advance(.5); assert.ok(game.getSnapshot().time > paused.time);
    game.restart(); assert.equal(game.getSnapshot().deaths, 4);
    assert.equal(game.getSnapshot().player.x, 100);
    game.advanceImpact(10); game.advanceFocusLoss(10);
    assert.equal(game.getSnapshot().mode, 'play');
});


test('renderer consumes snapshots and supports changed art without editing physics', async t => {
    for (const [key, value] of Object.entries({ devicePixelRatio: 1, ResizeObserver: class { observe() {} disconnect() {} } })) {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { value, configurable: true });
        t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
    }
    let paths = 0, labels = 0;
    const finite = (...args) => args.forEach(n => assert.ok(Number.isFinite(n)));
    const context = {
        save() {}, restore() {}, transform:finite, setTransform:finite, clearRect:finite, beginPath() { paths++; },
        moveTo:finite, lineTo:finite, bezierCurveTo:finite, closePath() {}, fill() {}, stroke() {}, clip() {}, setLineDash() {},
        measureText(text) { return { width: text.length * 8 }; },
        fillText(text, x, y) { assert.equal(typeof text, 'string'); finite(x, y); labels++; },
        createLinearGradient(...coords) { finite(...coords); return { addColorStop(at, color) { finite(at); assert.equal(typeof color, 'string'); } }; }
    };
    const canvas = () => ({ clientWidth:800, clientHeight:510, getContext:() => context });
    const canvases = { '[data-base]':canvas(), '[data-labels]':canvas(), '[data-tvg]':canvas() };
    const renderer = createRenderer({ isConnected:true, querySelector:s => canvases[s] });
    await Promise.resolve();
    const game = createGame(), effects = createEffects();
    const saved = { ...ART.player }, debug = ART.debugCollisions;
    Object.assign(ART.player, { offsetX:12, offsetY:-8, scale:1.3 }); ART.debugCollisions = true;
    try {
        game.reset();
        const scenario = { kind: 'forward', ticks: 2400 };
        for (let i = 0; i < 1300; i++) {
            applyInput(game, scenario, i); game.step(1 / 120);
            for (const event of game.drainEvents()) effects.receive(event);
            if (i % 40 === 0) {
                const before = game.getSnapshot();
                renderer.draw(before, effects.snapshot());
                assert.deepEqual(game.getSnapshot(), before);
            }
        }
        assert.ok(paths > 0); assert.ok(labels > 0);
        assert.equal(renderer.info().renderer, 'canvas2d');
    } finally { Object.assign(ART.player, saved); ART.debugCollisions = debug; renderer.destroy(); }
});

test('head impact and focus loss finish without any UI', () => {
    const head = createGame(); head.reset();
    const jumping = { kind: 'jump', interval: 90 };
    for (let i = 0; i < 500 && head.getSnapshot().mode === 'play'; i++) {
        applyInput(head, jumping, i); head.step(1 / 120); head.drainEvents();
    }
    assert.equal(head.getSnapshot().mode, 'impact');
    head.advanceImpact(10); assert.equal(head.getSnapshot().mode, 'dead');
    const focus = createGame(); focus.reset();
    const camping = { kind: 'camp', ticks: 6000 };
    for (let i = 0; i < camping.ticks && focus.getSnapshot().mode === 'play'; i++) {
        applyInput(focus, camping, i); focus.step(1 / 120); focus.drainEvents();
    }
    assert.equal(focus.getSnapshot().mode, 'focuslost');
    focus.advanceFocusLoss(1.7); assert.equal(focus.getSnapshot().mode, 'dead');
});
