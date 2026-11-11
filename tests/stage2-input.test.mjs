import assert from 'node:assert/strict';
import test from 'node:test';
import { bundled } from './support/load.mjs';

const { createGame, bindInput } = await bundled({ stdin: {
    contents: `export { createGame } from './src/game/game'; export { bindInput } from './src/ui/input';`,
    resolveDir: process.cwd(),
}, bundle: true, write: false, platform: 'node', format: 'esm' });

test('stage2 uses Down for meeting entry and exit, keeps Up for jumping, and supports touch', async () => {
    const names = ['window', 'document', 'Element', 'HTMLElement', 'MutationObserver'];
    const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    const window = new EventTarget(), document = new EventTarget();
    class Element {}
    const downButton = new EventTarget();
    Object.assign(globalThis, { window, document, Element, HTMLElement: Element,
        MutationObserver: class { observe() {} disconnect() {} },
    });
    const game = createGame(); game.startStage(2);
    const root = { isConnected: true, querySelector: selector => selector === '[data-interact]' ? downButton : null, querySelectorAll: () => [] };
    const unbind = bindInput(root, game);
    const key = (name, repeat = false) => {
        const event = new Event('keydown', { cancelable: true });
        Object.assign(event, { key: name, code: name, repeat });
        window.dispatchEvent(event);
        return event;
    };
    try {
        key('ArrowDown');
        assert.equal(game.getSnapshot().corridor.room.kind, 'corridor', 'Down outside the door does nothing');
        game.setInput('right');
        for (let i = 0; i < 1200 && !game.getSnapshot().canEnterMeeting; i++) game.step(1 / 120);
        game.clearInput();
        assert.ok(game.getSnapshot().canEnterMeeting);
        assert.ok(key('ArrowDown').defaultPrevented);
        assert.equal(game.getSnapshot().corridor.room.kind, 'meeting');
        key('ArrowDown', true);
        assert.equal(game.getSnapshot().corridor.room.kind, 'meeting', 'holding Down must not immediately leave');
        game.pause(); key('ArrowDown');
        assert.equal(game.getSnapshot().corridor.room.kind, 'meeting', 'pause ignores meeting input');
        game.pause(); key('ArrowDown');
        assert.equal(game.getSnapshot().corridor.room.kind, 'corridor');
        for (let i = 0; i < 12; i++) game.step(1 / 120);
        key('ArrowUp'); game.step(1 / 120);
        assert.equal(game.getSnapshot().corridor.room.kind, 'corridor');
        assert.ok(game.getSnapshot().player.vy < 0, 'Up still jumps at the meeting door');
        game.interact();
        assert.equal(game.getSnapshot().corridor.room.kind, 'corridor', 'airborne entry remains disabled');
        for (let i = 0; i < 180; i++) game.step(1 / 120);
        assert.ok(game.getSnapshot().canEnterMeeting);
        downButton.dispatchEvent(new Event('pointerdown', { cancelable: true }));
        assert.equal(game.getSnapshot().corridor.room.kind, 'meeting');
        downButton.dispatchEvent(new Event('pointerdown', { cancelable: true }));
        assert.equal(game.getSnapshot().corridor.room.kind, 'corridor');
        await Promise.resolve();
    } finally {
        unbind();
        for (const [name, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    }
});
