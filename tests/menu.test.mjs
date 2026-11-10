import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

async function load(entry) {
    const bundle = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' });
    return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const { createGame } = await load('src/game/game.ts');
const { createHud } = await load('src/ui/hud.ts');
const { createFeedback } = await load('src/ui/feedback.ts');
const { createEffects } = await load('src/render/effects.ts');

test('pause menu shows only cleared stages and hides spray controls until equipped', () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = () => ({ matches: false });
    try {
        const elements = new Map([
            '[data-spray-help]', '[data-spray]', '[data-stage-menu]',
            '[data-stage="1"]', '[data-stage="2"]', '[data-stage="3"]'
        ].map(selector => [selector, { hidden: false, classList: { toggle() {} } }]));
        const hud = createHud({ querySelector: selector => elements.get(selector) ?? null });
        const effects = createEffects().snapshot();
        const feedback = createFeedback().snapshot();
        const view = { cam: 0, scale: 1, vertical: 0, width: 800 };
        const fresh = createGame();
        fresh.reset();
        hud.draw(fresh.getSnapshot(), feedback, effects, view);
        for (const element of elements.values()) assert.equal(element.hidden, true);

        const continued = createGame({ progress: { completedStage: 1 } });
        continued.startStage(2);
        hud.draw(continued.getSnapshot(), feedback, effects, view);
        assert.equal(elements.get('[data-stage-menu]').hidden, false);
        assert.equal(elements.get('[data-stage="1"]').hidden, false);
        assert.equal(elements.get('[data-stage="2"]').hidden, true);
        assert.equal(elements.get('[data-stage="3"]').hidden, true);
        assert.equal(elements.get('[data-spray-help]').hidden, true);

        continued.startStage(3);
        hud.draw(continued.getSnapshot(), feedback, effects, view);
        assert.equal(elements.get('[data-spray-help]').hidden, true);
        for (let i = 0; i < 1440 && !continued.getSnapshot().hasExtinguisher; i++) {
            const state = continued.getSnapshot();
            continued.setInput('right');
            if (state.ground && ((state.player.x > 205 && state.player.x < 330) || (state.player.x > 370 && state.player.x < 450))) continued.jump();
            continued.step(1 / 120);
        }
        assert.equal(continued.getSnapshot().hasExtinguisher, true);
        hud.draw(continued.getSnapshot(), feedback, effects, view);
        assert.equal(elements.get('[data-spray-help]').hidden, false);
        assert.equal(elements.get('[data-spray]').hidden, false);
        continued.startStage(1);
        hud.draw(continued.getSnapshot(), feedback, effects, view);
        assert.equal(elements.get('[data-spray-help]').hidden, true);
        assert.equal(elements.get('[data-spray]').hidden, true);
    } finally {
        if (originalMatchMedia === undefined) delete globalThis.matchMedia;
        else globalThis.matchMedia = originalMatchMedia;
    }
});
