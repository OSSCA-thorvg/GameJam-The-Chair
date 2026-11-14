import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createDeathShot, deathShotCloseness, deathShotBurst, deathShotLength, DEATH_SHOT } = await loadSource(`
    export { createDeathShot, deathShotCloseness, deathShotBurst, deathShotLength, DEATH_SHOT } from './src/render/death-shot';
`);

test('a head hit in stages one to four bonks, pushes in on the face and eases back; stage five keeps its own ending', () => {
    for (const stage of [1, 2, 3, 4]) {
        const shot = createDeathShot();
        shot.observe({ stage, mode: 'play' });
        shot.observe({ stage, mode: 'impact' });
        assert.equal(shot.snapshot()?.kind, 'head', `stage ${stage}`);
    }
    const five = createDeathShot();
    five.observe({ stage: 5, mode: 'play' });
    five.observe({ stage: 5, mode: 'impact' });
    five.observe({ stage: 5, mode: 'focuslost' });
    assert.equal(five.snapshot(), null);

    const shot = createDeathShot();
    shot.observe({ stage: 2, mode: 'impact' });
    const at = age => ({ kind: 'head', age, done: false });
    const { hit, zoomIn, hold } = DEATH_SHOT.head;
    assert.equal(deathShotCloseness(at(hit - .1)), 0, 'the slow-motion replay keeps the usual framing');
    assert.equal(deathShotBurst(at(hit - .1)), null);
    assert.ok(deathShotBurst(at(hit + .1)) !== null, 'the BONK lands with the hit');
    assert.equal(deathShotCloseness(at(hit + zoomIn + hold / 2)), 1, 'held on the face');
    assert.equal(deathShotCloseness(at(deathShotLength('head'))), 0, 'back to the play framing');
    shot.advance(deathShotLength('head') - .01);
    assert.equal(shot.snapshot().done, false, 'the game-over panel still waits');
    shot.advance(.02);
    assert.equal(shot.snapshot().done, true);
    shot.observe({ stage: 2, mode: 'play' });
    assert.equal(shot.snapshot(), null, 'a retry clears it');
});

test('a focus loss pushes in on the eyes straight away and eases back', () => {
    const shot = createDeathShot();
    shot.observe({ stage: 1, mode: 'focuslost' });
    assert.equal(shot.snapshot()?.kind, 'focus');
    const at = age => ({ kind: 'focus', age, done: false });
    assert.ok(deathShotCloseness(at(.3)) > .9);
    assert.equal(deathShotBurst(at(.3)), null, 'no BONK for a focus loss');
    assert.equal(deathShotCloseness(at(deathShotLength('focus'))), 0);
});
