import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/game.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { createGame } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const dt = 1 / 120;

const GEYSERS = [{ x: 2600, period: 3.5, offset: 0 }, { x: 2850, period: 3.5, offset: 1.2 }, { x: 3100, period: 3.5, offset: 2.4 }];
function geyserBursting(g, t) {
    const p = ((t + g.offset) % g.period + g.period) % g.period;
    return p >= 2.0;
}
function drive(game, stop = state => state.mode !== 'play', options = {}) {
    const seen = { checkpoints: new Set(), cartHit: false, airborneAtCart: false };
    for (let i = 0; i < 120 * 60; i++) {
        const state = game.getSnapshot(), p = state.player;
        const simT = state.time;
        seen.checkpoints.add(state.checkpoint);
        seen.cartHit ||= !!state.corridor.cart?.hit;
        seen.airborneAtCart ||= !!state.corridor.cart && Math.abs(state.corridor.cart.x - p.x) < 100 && p.y < 320;
        if (stop(state)) return { state, seen };
        let hazardWait = false;
        if (state.stage === 1) {
            for (const g of GEYSERS) {
                if (g.x - p.x > 10 && g.x - p.x < 70 && geyserBursting(g, simT + .4)) { hazardWait = true; break; }
            }
        }
        const dodging = options.dodge && state.corridor.cart && state.corridor.cart.x - p.x > 0 && state.corridor.cart.x - p.x < 400;
        const correction = -p.a * 12 - p.w * 4;
        const keys = (hazardWait && !dodging) ? [] : ['right'];
        if (correction < -.4) keys.push('q');
        if (correction > .4) keys.push('e');
        game.setInput(...keys);
        if (options.dodge && state.ground && state.corridor.cart && state.corridor.cart.x - p.x > 0 && state.corridor.cart.x - p.x < 245) game.jump();
        game.step(dt);
        game.drainEvents();
    }
    assert.fail('Route did not finish within 60 simulated seconds');
}

test('stage2 completes through chair dispatch and elevator cart', () => {
    const game = createGame(); game.startStage(2);
    const { state, seen } = drive(game);
    assert.equal(state.mode, 'won');
    assert.equal(state.completedStage, 2);
    assert.equal(state.deaths, 0);
    assert.equal(state.checkpoint, 3);
    assert.deepEqual([...seen.checkpoints], [0, 1, 2, 3]);
    assert.ok(state.furniture.every(chair => chair.released));
    assert.ok(seen.cartHit, 'one cart collision remains recoverable');
    assert.equal(state.bursts, 0);
    assert.equal(state.cleaningSpilled, false);
});

test('document piles lift the rider, chairs, and delivery cart without blocking the route', () => {
    const random = Math.random;
    Math.random = () => .4;
    let game;
    try { game = createGame(); game.startStage(2); } finally { Math.random = random; }
    const piles = game.getSnapshot().corridor.paperPiles;
    assert.equal(piles.length, 5);
    assert.ok(piles.every(pile => pile.x - pile.halfWidth > 2200 && pile.x + pile.halfWidth < 3250));
    const lowest = { rider: 420, chair: 420, cart: 420 };
    const { state } = drive(game, snapshot => {
        const rider = snapshot.player;
        if (rider.x > 2250 && rider.x < 3200 && snapshot.ground) lowest.rider = Math.min(lowest.rider, rider.y + 28);
        for (const chair of snapshot.furniture) if (chair.x > 2250 && chair.x < 3200) lowest.chair = Math.min(lowest.chair, chair.y);
        const cart = snapshot.corridor.cart;
        if (cart && cart.x > 2250 && cart.x < 3200) lowest.cart = Math.min(lowest.cart, cart.y);
        return snapshot.mode !== 'play';
    });
    assert.equal(state.mode, 'won');
    assert.ok(lowest.rider < 415, `rider never climbed a pile: ${lowest.rider}`);
    assert.ok(lowest.chair < 415, `chairs never climbed a pile: ${lowest.chair}`);
    assert.ok(lowest.cart < 415, `cart never climbed a pile: ${lowest.cart}`);
});

test('cart shove remains recoverable when random draws are high', () => {
    const random = Math.random;
    Math.random = () => .99;
    try {
        const game = createGame(); game.startStage(2);
        const { state, seen } = drive(game);
        assert.ok(seen.cartHit);
        assert.equal(state.mode, 'won');
    } finally {
        Math.random = random;
    }
});

test('jumping over the cart also leads to the exit without losing focus', () => {
    const game = createGame(); game.startStage(2);
    const { state, seen } = drive(game, undefined, { dodge: true });
    assert.equal(state.mode, 'won');
    assert.equal(state.deaths, 0);
    assert.equal(seen.cartHit, false);
    assert.ok(seen.airborneAtCart);
    assert.equal(state.focus, 100);
});


test('restart resumes at the last reached checkpoint and stage selection starts fresh', () => {
    const game = createGame();
    game.startStage(2);
    drive(game, state => state.checkpoint === 3);
    game.restart();
    const saved = game.getSnapshot();
    assert.equal(saved.stage, 2);
    assert.equal(saved.checkpoint, 3);
    assert.equal(saved.player.x, 3400);
    assert.equal(saved.deaths, 1);
    assert.equal(saved.corridor.departure.kind, 'gone');
    assert.equal(saved.corridor.room.kind, 'corridor');
    game.startStage(2);
    assert.equal(game.getSnapshot().player.x, 100);
    assert.equal(game.getSnapshot().checkpoint, 0);
    game.startStage(1);
    assert.equal(game.getSnapshot().level.goal, 3240);
    assert.equal(game.getSnapshot().people.length, 3);
});

test('three chairs are dispatched in sequence and snapshots cannot edit them', () => {
    const game = createGame(); game.startStage(2);
    drive(game, state => state.corridor.dispatchStarted);
    game.setInput();
    const released = [];
    for (let i = 0; i < 420; i++) {
        game.step(dt); game.drainEvents();
        const count = game.getSnapshot().furniture.filter(c => c.released).length;
        if (released.at(-1) !== count) released.push(count);
    }
    assert.deepEqual(released, [0, 1, 2, 3]);
    const state = game.getSnapshot();
    assert.ok(state.furniture.every(c => c.x > 680));
    state.player.x = 99999; state.furniture[0].x = 99999;
    state.corridor.cartHits = 999;
    assert.ok(game.getSnapshot().player.x < 1000);
    assert.ok(game.getSnapshot().furniture[0].x < 2000);
    assert.equal(game.getSnapshot().corridor.cartHits, 0);
});


test('head impact can be retried from the saved flag', () => {
    const game = createGame();
    game.startStage(2);
    drive(game, state => state.checkpoint === 1);
    game.setInput('e');
    game.jump();
    for (let i = 0; i < 120 * 10 && game.getSnapshot().mode === 'play'; i++) {
        game.step(dt);
        game.drainEvents();
    }
    assert.equal(game.getSnapshot().mode, 'impact');
    game.advance(3);
    assert.equal(game.getSnapshot().mode, 'dead');
    game.reset();
    assert.equal(game.getSnapshot().player.x, 1300);
    assert.equal(game.getSnapshot().checkpoint, 1);
});

test('stage1 still emits copier hazards after switching back from stage2', () => {
    const game = createGame();
    game.startStage(2);
    game.startStage(1);
    game.setInput('right');
    for (let i = 0; i < 360; i++) { game.step(dt); game.drainEvents(); }
    assert.ok(game.getSnapshot().bursts > 0);
});

test('optional meeting scene returns the rider automatically and can be left early', () => {
    for (const early of [false, true]) {
        const game = createGame(); game.startStage(2);
        drive(game, state => state.canEnterMeeting);
        const start = game.getSnapshot().player.x;
        game.interact();
        assert.equal(game.getSnapshot().corridor.room.kind, 'meeting');
        assert.ok(game.getSnapshot().corridor.meetingVisited);
        game.setInput('right'); game.jump();
        for (let i = 0; i < 120; i++) game.step(dt);
        game.pause(); const paused = game.getSnapshot(); game.advance(5);
        assert.deepEqual(game.getSnapshot(), paused); game.pause();
        if (early) game.interact();
        else for (let i = 0; i < 610; i++) game.step(dt);
        const state = game.getSnapshot();
        assert.equal(state.mode, 'play');
        assert.equal(state.corridor.room.kind, 'corridor');
        assert.ok(state.player.x >= start - 1);
        assert.equal(state.deaths, 0);
        assert.equal(drive(game).state.mode, 'won');
    }
});

test('office typing bubbles fade, repeat nearby and reactivate on a return visit', () => {
    const game = createGame(); game.startStage(2);
    game.setInput('right');
    for (let i = 0; i < 45; i++) game.step(dt);
    assert.ok(game.getSnapshot().corridor.offices[0].life > 0);
    game.setInput();
    for (let i = 0; i < 190; i++) game.step(dt);
    assert.equal(game.getSnapshot().corridor.offices[0].life, 0);
    for (let i = 0; i < 360; i++) game.step(dt);
    assert.ok(game.getSnapshot().corridor.offices[0].life > 0);
    game.setInput('right');
    for (let i = 0; i < 1200 && game.getSnapshot().player.x < 460; i++) game.step(dt);
    assert.equal(game.getSnapshot().corridor.offices[0].nearby, false);
    game.setInput('left');
    for (let i = 0; i < 1200 && !game.getSnapshot().corridor.offices[0].nearby; i++) game.step(dt);
    assert.ok(game.getSnapshot().corridor.offices[0].life > 0, 'returning to the window triggers another brief bubble');
});


test('stationary and forward jumps can land safely in both starter practice areas', () => {
    for (const stage of [1, 2]) {
        for (const input of [[], ['right']]) {
            const game = createGame();
            game.startStage(stage);
            for (let i = 0; i < 12; i++) game.step(dt);
            game.setInput(...input);
            game.jump();
            let airborne = false;
            let landed = false;
            for (let i = 0; i < 180; i++) {
                game.step(dt);
                game.drainEvents();
                const state = game.getSnapshot();
                assert.equal(state.mode, 'play', `stage ${stage}, input ${input}`);
                airborne ||= !state.ground;
                if (airborne && state.ground) { landed = true; break; }
            }
            assert.ok(landed);
            assert.ok(game.getSnapshot().tutorialAssist);
        }
    }
});

test('office bin retries restore a dry, focused chair at the safe approach flag', () => {
    const game = createGame();
    game.startStage(1);
    game.setInput('right');
    for (let i = 0; i < 120 * 20 && game.getSnapshot().mode === 'play'; i++) {
        game.step(dt);
        game.drainEvents();
    }
    const failed = game.getSnapshot();
    assert.equal(failed.lossReason, 'bin');
    assert.equal(failed.officeCheckpoint, true);
    game.reset();
    const retry = game.getSnapshot();
    assert.equal(retry.player.x, 1400);
    assert.equal(retry.focus, 100);
    assert.equal(retry.soaked, false);
    assert.equal(retry.cleaningSpilled, false);
    assert.equal(retry.actualSpeed, 0);
    game.startStage(1);
    assert.equal(game.getSnapshot().officeCheckpoint, false);
    assert.equal(game.getSnapshot().player.x, 100);
});

test('the office flag restores focus when first reached after a distraction', () => {
    const game = createGame();
    game.startStage(1);
    game.setInput('right');
    let focusLostBeforeFlag = false;
    for (let i = 0; i < 120 * 20 && !game.getSnapshot().officeCheckpoint; i++) {
        game.step(dt);
        const state = game.getSnapshot();
        if (state.focus < 100) focusLostBeforeFlag = true;
        assert.equal(state.mode, 'play');
    }
    assert.equal(focusLostBeforeFlag, true);
    assert.equal(game.getSnapshot().officeCheckpoint, true);
    assert.equal(game.getSnapshot().focus, 100);

    game.setInput('left');
    for (let i = 0; i < 120 * 20 && game.getSnapshot().player.x > 750; i++) game.step(dt);
    assert.ok(game.getSnapshot().focus < 100);
    game.setInput('right');
    for (let i = 0; i < 120 * 20 && game.getSnapshot().player.x < 1450; i++) game.step(dt);
    assert.equal(game.getSnapshot().mode, 'play');
    assert.ok(game.getSnapshot().focus < 100, 'crossing the saved flag again must not refill focus');
});

test('airborne Q/E correction works while holding the opposite movement key', () => {
    for (const [input, sign] of [[['right', 'q'], -1], [['left', 'e'], 1]]) {
        const game = createGame();
        game.startStage(2);
        drive(game, state => state.checkpoint === 1);
        game.reset();
        for (let i = 0; i < 12; i++) game.step(dt);
        game.setInput(...input);
        game.jump();
        for (let i = 0; i < 12; i++) game.step(dt);
        const state = game.getSnapshot();
        assert.equal(state.ground, false);
        assert.ok(sign * state.player.w > .5, 'manual balance overrides movement tilt');
    }
});

test('jumping across the office flag still saves the safe retry location', () => {
    const game = createGame();
    game.startStage(1);
    game.setInput('right');
    for (let i = 0; i < 120 * 15 && game.getSnapshot().player.x < 1330; i++) game.step(dt);
    game.jump();
    for (let i = 0; i < 120 && game.getSnapshot().player.x < 1400; i++) game.step(dt);
    assert.equal(game.getSnapshot().ground, false);
    assert.equal(game.getSnapshot().officeCheckpoint, true);
    game.reset();
    assert.equal(game.getSnapshot().player.x, 1400);
});

test('starter jump completes one contextual lesson and emits its reward once', () => {
    const game = createGame();
    game.startStage(1);
    let rewards = 0;
    for (let jump = 0; jump < 2; jump++) {
        for (let i = 0; i < 12; i++) game.step(dt);
        game.jump();
        for (let i = 0; i < 180; i++) {
            game.step(dt);
            rewards += game.drainEvents().filter(e => e.type === 'cue' && e.id === 'practice-cleared').length;
        }
    }
    assert.equal(game.getSnapshot().lessons.jumped, true);
    assert.equal(rewards, 1);
    game.setInput('right');
    for (let i = 0; i < 100; i++) game.step(dt);
    assert.equal(game.getSnapshot().lessons.moved, true);
});

test('spray on stage three gives upward recoil, consumes ammo, and reloads on ground', () => {
    const game = createGame();
    game.startStage(3);
    for (let i = 0; i < 60; i++) game.step(dt);
    const before = game.getSnapshot();
    assert.equal(before.spray.ammo, 4);
    game.spray();
    game.step(dt);
    const afterBurst = game.getSnapshot();
    assert.equal(afterBurst.spray.ammo, 3);
    assert.ok(afterBurst.player.vy < before.player.vy, 'recoil must push the chair upward');
    for (let i = 0; i < 200; i++) game.step(dt);
    assert.ok(game.getSnapshot().spray.ammo > 3, 'ammo regenerates while grounded');
});

test('fire extinguisher refuses to spray with empty tank', () => {
    const game = createGame();
    game.startStage(3);
    for (let i = 0; i < 60; i++) game.step(dt);
    for (let shot = 0; shot < 4; shot++) {
        game.spray();
        for (let i = 0; i < 48; i++) game.step(dt);
    }
    assert.equal(game.getSnapshot().spray.ammo, 0);
    game.drainEvents();
    game.spray();
    const events = game.drainEvents();
    assert.ok(events.some(e => e.type === 'cue' && e.id === 'spray-empty'));
});

test('copier previews its shot and its first paper batch is safe', () => {
    const game = createGame();
    game.startStage(1);
    game.setInput('right');
    for (let i = 0; i < 1000 && game.getSnapshot().copier.burst === 0; i++) game.step(dt);
    let state = game.getSnapshot();
    assert.equal(state.copier.burst, 4);
    assert.equal(state.papers.length, 0);
    for (let i = 0; i < 60; i++) game.step(dt);
    assert.equal(game.getSnapshot().papers.length, 0, 'rollers precede the first shot');
    for (let i = 0; i < 60 && game.getSnapshot().bursts === 0; i++) game.step(dt);
    state = game.getSnapshot();
    assert.equal(state.bursts, 1);
    assert.ok(state.papers.every(paper => paper.safe));
    for (let i = 0; i < 60 && game.getSnapshot().bursts < 2; i++) game.step(dt);
    assert.ok(game.getSnapshot().papers.some(paper => !paper.safe), 'later shots retain the hazard');
});


test('extinguisher becomes available in stage three and cannot be used in earlier stages', () => {
    const game = createGame();
    for (const stage of [1, 2, 3, 1]) {
        game.startStage(stage);
        game.drainEvents();
        const before = game.getSnapshot();
        assert.equal(before.hasExtinguisher, stage === 3);
        game.spray();
        const after = game.getSnapshot();
        if (stage === 3) {
            assert.equal(after.spray.ammo, before.spray.ammo - 1);
            assert.ok(game.drainEvents().some(event => event.type === 'cue' && event.id === 'spray'));
        } else {
            assert.deepEqual(after, before);
            assert.deepEqual(game.drainEvents(), []);
        }
    }
});

test('cleared-stage history survives retries, stage changes and saved-game restoration', () => {
    const game = createGame(0, 1);
    assert.equal(game.getSnapshot().completedStage, 1);
    game.startStage(2);
    assert.equal(game.getSnapshot().completedStage, 1, 'entering a stage does not mark it cleared');
    const { state } = drive(game);
    assert.equal(state.completedStage, 2);
    game.restart();
    assert.equal(game.getSnapshot().completedStage, 2);
    game.startStage(1);
    assert.equal(game.getSnapshot().completedStage, 2);
    const restored = createGame(state.deaths, state.completedStage);
    assert.equal(restored.getSnapshot().completedStage, 2);
    assert.equal(createGame().getSnapshot().completedStage, 0);
});


test('removed braking commands do not slow or stabilize a coasting chair', () => {
    for (const command of ['brake', 'ArrowDown', 's']) {
        const coasting = createGame();
        const removedInput = createGame();
        for (const game of [coasting, removedInput]) {
            game.reset();
            game.setInput('right');
            for (let i = 0; i < 60; i++) game.step(dt);
        }
        coasting.setInput();
        removedInput.setInput(command);
        for (let i = 0; i < 60; i++) {
            coasting.step(dt);
            removedInput.step(dt);
            assert.deepEqual(removedInput.getSnapshot().player, coasting.getSnapshot().player);
        }
    }
});
