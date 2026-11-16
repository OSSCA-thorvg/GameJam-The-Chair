import assert from 'node:assert/strict';
import test from 'node:test';
import { load } from './support/load.mjs';

const { createGame } = await load('src/game/game.ts');
const { createHud } = await load('src/ui/hud.ts');
const { createFeedback } = await load('src/ui/feedback.ts');
const { createEffects } = await load('src/render/effects.ts');

test('pause menu shows unlocked stages and hides spray controls until equipped', () => {
    const originalMatchMedia = globalThis.matchMedia;
    /** @type {any} */ (globalThis).matchMedia = () => ({ matches: false });
    try {
        const elements = new Map([
            '[data-spray-help]', '[data-spray]', '[data-stage-menu]', '[data-play-hud]', '.drive-controls',
            '[data-stage="1"]', '[data-stage="2"]', '[data-stage="3"]'
        ].map(selector => [selector, { hidden: false, classList: { toggle() {} }, toggleAttribute() {} }]));
        const hud = createHud({ querySelector: selector => elements.get(selector) ?? null });
        const effects = createEffects().snapshot();
        const feedback = createFeedback().snapshot();
        const fresh = createGame();
        fresh.reset();
        hud.draw(fresh.getSnapshot(), feedback, effects);
        assert.equal(elements.get('[data-stage-menu]').hidden, true);
        assert.equal(elements.get('[data-play-hud]').hidden, false);
        assert.equal(elements.get('.drive-controls').hidden, false);
        hud.draw(fresh.getSnapshot(), feedback, effects, true);
        assert.equal(elements.get('[data-play-hud]').hidden, true);
        assert.equal(elements.get('.drive-controls').hidden, true);
        hud.draw(fresh.getSnapshot(), feedback, effects, false);
        assert.equal(elements.get('[data-play-hud]').hidden, false);

        const continued = createGame({ progress: { completedStage: 1 } });
        continued.startStage(2);
        hud.draw(continued.getSnapshot(), feedback, effects);
        assert.equal(elements.get('[data-stage-menu]').hidden, false);
        assert.equal(elements.get('[data-stage="1"]').hidden, false);
        assert.equal(elements.get('[data-stage="2"]').hidden, false);
        assert.equal(elements.get('[data-stage="3"]').hidden, true);
        assert.equal(elements.get('[data-spray-help]').hidden, true);

        continued.startStage(3);
        hud.draw(continued.getSnapshot(), feedback, effects);
        assert.equal(elements.get('[data-spray-help]').hidden, true);
        for (let i = 0; i < 1440 && !continued.getSnapshot().hasExtinguisher; i++) {
            const state = continued.getSnapshot();
            continued.setInput('right');
            if (state.ground && ((state.player.x > 205 && state.player.x < 330) || (state.player.x > 370 && state.player.x < 450))) continued.jump();
            continued.step(1 / 120);
        }
        assert.equal(continued.getSnapshot().hasExtinguisher, true);
        hud.draw(continued.getSnapshot(), feedback, effects);
        assert.equal(elements.get('[data-spray-help]').hidden, false);
        assert.equal(elements.get('[data-spray]').hidden, false);
        continued.startStage(1);
        hud.draw(continued.getSnapshot(), feedback, effects);
        assert.equal(elements.get('[data-spray-help]').hidden, true);
        assert.equal(elements.get('[data-spray]').hidden, true);
    } finally {
        if (originalMatchMedia === undefined) delete globalThis.matchMedia;
        else /** @type {any} */ (globalThis).matchMedia = originalMatchMedia;
    }
});
