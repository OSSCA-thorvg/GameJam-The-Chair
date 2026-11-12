import assert from 'node:assert/strict';
import test from 'node:test';
import { driveStageFour } from './support/stage4-route.mjs';
import { bundled } from './support/load.mjs';
const { createGame, bindInput } = await bundled({ stdin: { contents: `export { createGame } from './src/game/game'; export { bindInput } from './src/ui/input';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });

test('stage 4 ending completes automatically and gameplay buttons do not change its depth', async () => {
    const names = ['window', 'document', 'Element', 'HTMLElement', 'MutationObserver'];
    const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    const window = new EventTarget(), document = new EventTarget();
    class Element {}
    const jumpButton = new EventTarget(), backButton = new EventTarget();
    jumpButton.setPointerCapture = backButton.setPointerCapture = () => {};
    Object.assign(globalThis, { window, document, Element, HTMLElement: Element, MutationObserver: class { observe() {} disconnect() {} } });
    const game = createGame(); game.startStage(4);
    const reached = {};
    try { driveStageFour(game, state => { if (state.sky.phase === 'depth') throw reached; }); } catch (e) { if (e !== reached) throw e; }
    game.clearInput();
    const root = { isConnected: true, querySelector: s => s === '[data-jump]' ? jumpButton : s === '[data-interact]' ? backButton : null, querySelectorAll: () => [] };
    const unbind = bindInput(root, game);
    const key = (type, name) => { const e = new Event(type, { cancelable: true }); Object.assign(e, { key: name, code: name, repeat: false }); window.dispatchEvent(e); return e; };
    const depthAfter = (frames = 30) => { const before = game.getSnapshot().sky.depth; for (let i = 0; i < frames; i++) game.step(1 / 120); return game.getSnapshot().sky.depth - before; };
    try {
        assert.equal(game.getSnapshot().sky.phase, 'depth');
        assert.ok(key('keydown', 'ArrowUp').defaultPrevented);
        assert.equal(depthAfter(), 0, 'Up cannot move the automatic camera');
        key('keyup', 'ArrowUp');
        assert.equal(depthAfter(), 0, 'releasing Up stops');
        key('keydown', 'ArrowDown');
        assert.equal(depthAfter(), 0, 'Down cannot move the automatic camera');
        key('keyup', 'ArrowDown');
        jumpButton.dispatchEvent(new Event('pointerdown', { cancelable: true }));
        assert.equal(depthAfter(), 0, 'touch cannot move the automatic camera');
        jumpButton.dispatchEvent(new Event('pointerup'));
        assert.equal(depthAfter(), 0, 'releasing the button stops');
        for (let i = 0; i < 600 && game.getSnapshot().stage === 4; i++) game.step(1 / 120);
        assert.equal(game.getSnapshot().stage, 5);
        assert.equal(game.getSnapshot().mode, 'play');
        assert.equal(game.getSnapshot().completedStage, 4);
        await Promise.resolve();
    } finally {
        unbind();
        for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    }
});
