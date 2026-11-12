import assert from 'node:assert/strict';
import test from 'node:test';
import { bundled } from './support/load.mjs';
import { createExpressRider } from './support/harness.mjs';

const { createGame } = await bundled({ entryPoints: ['src/game/game.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const dt = 1 / 120;

const GEYSERS = [{ x: 2600, period: 3.5, offset: 0 }, { x: 2850, period: 3.5, offset: 1.2 }, { x: 3100, period: 3.5, offset: 2.4 }];
function geyserBursting(g, t) {
    const p = ((t + g.offset) % g.period + g.period) % g.period;
    return p >= 2.0;
}
function drive(game, stop = state => state.mode !== 'play', options = {}) {
    const seen = { checkpoints: new Set(), express: false, bumps: 0, chats: new Set() };
    const express = createExpressRider(options.stayAboard);
    for (let i = 0; i < 120 * 60; i++) {
        const state = game.getSnapshot(), p = state.player;
        const simT = state.time;
        seen.checkpoints.add(state.checkpoint);
        seen.express ||= state.corridor.pace === 'express';
        if (state.stage === 2) seen.chats.add(state.corridor.chat.kind);
        if (stop(state)) return { state, seen };
        let hazardWait = false;
        if (state.stage === 1) {
            for (const g of GEYSERS) {
                if (g.x - p.x > 10 && g.x - p.x < 70 && geyserBursting(g, simT + .4)) { hazardWait = true; break; }
            }
        }
        const correction = -p.a * 12 - p.w * 4;
        // The express convoy hops the cable covers and leaps the hole; with stayAboard it gets swept into the lift.
        const keys = (state.stage === 2 ? express(state, game) : null) ?? (hazardWait ? [] : ['right']);
        if (correction < -.4) keys.push('q');
        if (correction > .4) keys.push('e');
        game.setInput(...keys);
        game.step(dt);
        for (const event of game.drainEvents()) if (event.type === 'cue' && event.id === 'convoy-bump') seen.bumps++;
    }
    assert.fail('Route did not finish within 60 simulated seconds');
}

test('stage2 completes through chair dispatch and the clock-out lift', () => {
    const game = createGame(); game.startStage(2);
    const { state, seen } = drive(game);
    assert.equal(state.mode, 'won');
    assert.equal(state.completedStage, 2);
    assert.equal(state.deaths, 0);
    assert.equal(state.checkpoint, 3);
    assert.deepEqual([...seen.checkpoints], [0, 1, 2, 3]);
    assert.ok(state.furniture.every(chair => chair.released));
    assert.ok(seen.express, 'the convoy speeds up before the lift');
    assert.equal(seen.bumps, 0, 'every cable cover was hopped');
    assert.ok(seen.chats.has('pit'), 'the chairs shout back about the plank before the hole');
    assert.notEqual(state.corridor.departure.kind, 'none', 'the chairs head into the lift');
    assert.notEqual(state.corridor.departure.reason, 'abduction', 'the rider is not taken along');
    assert.equal(state.bursts, 0);
    assert.equal(state.cleaningSpilled, false);
});

test('staying aboard the express convoy ends in a forced clock-out', () => {
    const game = createGame(); game.startStage(2);
    const { state } = drive(game, undefined, { stayAboard: true });
    assert.equal(state.mode, 'dead');
    assert.equal(state.lossReason, 'lift');
    assert.equal(state.deaths, 1);
    assert.equal(state.corridor.departure.kind, 'lost');
    game.reset();
    assert.equal(game.getSnapshot().mode, 'play');
    assert.equal(game.getSnapshot().checkpoint, 2, 'retry starts from the last flag before the lift');
});

test('hopping the covers and leaping the hole reaches the exit without losing focus', () => {
    const game = createGame(); game.startStage(2);
    const { state } = drive(game);
    assert.equal(state.mode, 'won');
    assert.equal(state.deaths, 0);
    assert.equal(state.focus, 100);
    assert.ok(state.player.x >= state.level.goal);
});

test('riding the express without hopping: a cover kicks the rookie off and the hole takes it', () => {
    const game = createGame(); game.startStage(2);
    drive(game, state => state.corridor.pace === 'express' && state.corridor.convoy === 'carried');
    game.clearInput();
    const cues = [];
    let kicked = null;
    for (let i = 0; i < 120 * 12 && game.getSnapshot().deaths === 0; i++) {
        game.step(dt);
        const state = game.getSnapshot();
        for (const event of game.drainEvents()) if (event.type === 'cue') cues.push(event.id);
        if (kicked === null && cues.includes('convoy-bump')) kicked = state;
        // Back on its wheels, it chases the chairs on foot.
        if (kicked && state.ground && state.corridor.convoy === 'free') game.setInput('right');
    }
    assert.ok(kicked, 'the first cable cover kicks the carried rider');
    assert.ok(kicked.player.vy < 0 && kicked.player.vx < 200, 'up and slowed: no brakes for the rookie');
    assert.equal(kicked.focus, 90);
    const state = game.getSnapshot();
    assert.equal(state.deaths, 1, 'left behind, the rider rolls into the construction hole');
    assert.equal(state.checkpoint, 2);
    assert.equal(state.player.x, 2200, 'the retry starts at the flag before the rush');
});

test('restart resumes at the last reached checkpoint and stage selection starts fresh', () => {
    const game = createGame();
    game.startStage(2);
    drive(game, state => state.checkpoint === 3);
    game.restart();
    const saved = game.getSnapshot();
    assert.equal(saved.stage, 2);
    assert.equal(saved.checkpoint, 3);
    assert.equal(saved.player.x, 4200);
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
    const convoy = state.corridor.convoy;
    state.corridor.convoy = convoy === 'free' ? 'carried' : 'free';
    assert.ok(game.getSnapshot().player.x < 1000);
    assert.ok(game.getSnapshot().furniture[0].x < 2000);
    assert.equal(game.getSnapshot().corridor.convoy, convoy);
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
    for (let i = 0; i < 120 * 20 && game.getSnapshot().player.x > 1150; i++) game.step(dt);
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

test('holding right runs into the copier papers while the copier keeps firing', () => {
    const game = createGame();
    game.startStage(1);
    const start = game.getSnapshot();
    assert.ok(start.copier.x - start.player.x >= 600);
    assert.ok(start.cleaning.x - start.copier.x >= 300);
    assert.equal(start.people.find(person => person.id === 'cleaner').x - start.cleaning.x, 55);
    game.setInput('right');
    let firstHitX;
    let firstHitFocus;
    for (let i = 0; i < 120 * 6 && game.getSnapshot().mode === 'play'; i++) {
        game.step(dt);
        const state = game.getSnapshot();
        if (firstHitX === undefined && state.paperHits > 0) {
            firstHitX = state.player.x;
            firstHitFocus = state.focus;
        }
        if (state.player.x > state.copier.x + 350 && state.bursts >= 8) break;
    }
    const state = game.getSnapshot();
    assert.ok(firstHitX !== undefined && firstHitX < state.copier.x, 'the rider must meet hazardous paper before passing the copier');
    assert.equal(firstHitFocus, 85, 'the first copier hit costs 15 focus once per volley');
    assert.ok(state.player.x > state.copier.x + 350);
    assert.ok(state.bursts >= 8, 'the copier must fire another volley after the rider leaves its trigger range');
});


test('cleared-stage history survives retries, stage changes and saved-game restoration', () => {
    const game = createGame({ progress: { completedStage: 1 } });
    assert.equal(game.getSnapshot().completedStage, 1);
    game.startStage(2);
    assert.equal(game.getSnapshot().completedStage, 1, 'entering a stage does not mark it cleared');
    const { state } = drive(game);
    assert.equal(state.completedStage, 2);
    game.restart();
    assert.equal(game.getSnapshot().completedStage, 2);
    game.startStage(1);
    assert.equal(game.getSnapshot().completedStage, 2);
    const restored = createGame({ progress: { deaths: state.deaths, completedStage: state.completedStage } });
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
