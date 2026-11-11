import assert from 'node:assert/strict';
import test from 'node:test';
import { driveStageThree } from './support/stage3-route.mjs';
import { bundled } from './support/load.mjs';
const { createGame, bindInput } = await bundled({ stdin: { contents: `export { createGame } from './src/game/game'; export { bindInput } from './src/ui/input';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });

test('Space holds spray in stage three, releases on keyup/blur, and touch capture releases', async () => {
    const names = ['window', 'document', 'Element', 'HTMLElement', 'MutationObserver'];
    const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    const window = new EventTarget(), document = new EventTarget();
    class Element {}
    const spray = new EventTarget(); spray.setPointerCapture = () => {};
    Object.assign(globalThis, { window, document, Element, HTMLElement: Element, MutationObserver: class { observe() {} disconnect() {} } });
    const game = createGame(); game.startStage(3);
    driveStageThree(game, state => state.hasExtinguisher);
    const root = { isConnected: true, querySelector: selector => selector === '[data-spray]' ? spray : null, querySelectorAll: () => [] };
    const unbind = bindInput(root, game);
    function key(type, name, code = name) {
        const event = new Event(type, { cancelable: true });
        Object.assign(event, { key: name, code, repeat: false }); window.dispatchEvent(event);
    }
    const settle = () => { game.restart(); for (let i = 0; i < 20; i++) game.step(1 / 120); game.drainEvents(); };
    const advance = () => { for (let i = 0; i < 60; i++) game.step(1 / 120); };
    try {
        settle(); key('keydown', ' ', 'Space'); advance();
        assert.equal(game.drainEvents().filter(e => e.id === 'spray').length, 3);
        key('keyup', ' ', 'Space'); advance();
        assert.equal(game.getSnapshot().spray.burst, 0);
        settle(); key('keydown', 'f'); window.dispatchEvent(new Event('blur')); advance();
        assert.equal(game.drainEvents().filter(e => e.id === 'spray').length, 0);
        settle(); spray.dispatchEvent(new Event('pointerdown', { cancelable: true })); advance();
        assert.equal(game.drainEvents().filter(e => e.id === 'spray').length, 3);
        spray.dispatchEvent(new Event('lostpointercapture')); advance();
        assert.equal(game.getSnapshot().spray.burst, 0);
        settle(); key('keydown', 'ArrowUp'); game.step(1 / 120);
        assert.ok(game.getSnapshot().player.vy < -300);
        game.startStage(1); for (let i = 0; i < 20; i++) game.step(1 / 120);
        key('keydown', ' ', 'Space'); game.step(1 / 120);
        assert.ok(game.getSnapshot().player.vy > -300, 'Space no longer jumps in the office');
        for (let i = 0; i < 20; i++) game.step(1 / 120);
        key('keydown', 'ArrowUp'); game.step(1 / 120);
        assert.ok(game.getSnapshot().player.vy < -300, 'Up jumps in the office');
        await Promise.resolve();
    } finally {
        unbind();
        for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    }
});
