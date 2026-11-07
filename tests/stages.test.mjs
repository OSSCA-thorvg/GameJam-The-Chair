import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/game/game.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { createGame } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const dt = 1 / 120;

function drive(game, stop = state => state.mode !== 'play') {
    const seen = { cabinet: false, elevator: false, recovery: false, checkpoints: new Set() };
    let liftReady = false;
    for (let i = 0; i < 120 * 60; i++) {
        const state = game.getSnapshot();
        const p = state.player;
        seen.cabinet ||= state.ground && p.x > 2220 && p.x < 2350 && Math.abs(p.y + 28 - 365) < 12;
        seen.elevator ||= state.ground && p.x > state.elevator.x && p.x < state.elevator.x + state.elevator.width && Math.abs(p.y + 28 - state.elevator.y) < 12;
        seen.recovery ||= p.x > 3000 && p.y > 330;
        seen.checkpoints.add(state.checkpoint);
        if (stop(state)) return { state, seen };
        const correction = -p.a * 12 - p.w * 4;
        const keys = ['right'];
        if (!state.ground) {
            if (correction < -.4) keys.splice(0, 1, 'q');
            else if (correction < .4) keys.push('q');
        } else {
            if (correction < -.4) keys.push('q');
            else if (correction > .4) keys.push('e');
        }
        if (p.x > 2520 && p.x < 2650 && !liftReady) {
            liftReady = state.time % 8 > 7;
            if (!liftReady) keys.splice(0, keys.length, 'brake');
        }
        game.setInput(...keys);
        if (state.ground && ((p.x > 460 && p.x < 670) || (p.x > 2160 && p.x < 2370))) game.jump();
        game.step(dt);
        game.drainEvents();
    }
    assert.fail('Route did not finish within 60 simulated seconds');
}

test('stage2 can be completed through furniture, vent, moving platform and recovery ramp', () => {
    const game = createGame();
    game.startStage(2);
    const { state, seen } = drive(game);
    assert.equal(state.mode, 'won');
    assert.equal(state.deaths, 0);
    assert.equal(state.checkpoint, 4);
    assert.deepEqual([...seen.checkpoints], [0, 1, 2, 3, 4]);
    assert.ok(seen.cabinet, 'player climbs furniture to reach vent');
    assert.ok(seen.elevator, 'player lands on moving platform');
    assert.ok(seen.recovery, 'lower route leads back to goal');
    assert.equal(state.bursts, 0);
    assert.equal(state.cleaningSpilled, false);
});

test('restart resumes at the last reached checkpoint and stage selection starts fresh', () => {
    const game = createGame();
    game.startStage(2);
    drive(game, state => state.checkpoint === 3);
    game.restart();
    const saved = game.getSnapshot();
    assert.equal(saved.stage, 2);
    assert.equal(saved.checkpoint, 3);
    assert.equal(saved.player.x, 2490);
    assert.equal(saved.deaths, 1);
    game.startStage(2);
    assert.equal(game.getSnapshot().player.x, 100);
    assert.equal(game.getSnapshot().checkpoint, 0);
    game.startStage(1);
    assert.equal(game.getSnapshot().level.goal, 2440);
    assert.equal(game.getSnapshot().people.length, 3);
});

test('furniture moves when pushed and snapshots cannot edit live state', () => {
    const game = createGame();
    game.startStage(2);
    game.setInput('right');
    for (let i = 0; i < 240; i++) { game.step(dt); game.drainEvents(); }
    const snapshot = game.getSnapshot();
    assert.ok(snapshot.furniture[0].x > 450);
    snapshot.player.x = 99999;
    snapshot.furniture[0].x = 99999;
    assert.ok(game.getSnapshot().player.x < 500);
    assert.ok(game.getSnapshot().furniture[0].x < 650);
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
    assert.equal(game.getSnapshot().player.x, 960);
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

test('each revolving-door collision costs 20 focus and repeated hits cause game over', () => {
    const game = createGame();
    game.startStage(2);
    drive(game, state => state.player.x > 650);
    let hits = 0;
    for (let i = 0; i < 120 * 60; i++) {
        const before = game.getSnapshot();
        if (before.mode !== 'play') break;
        game.setInput(before.player.x < before.door.x ? 'right' : 'left');
        game.step(dt);
        const after = game.getSnapshot();
        if (after.doorHits > before.doorHits) {
            hits++;
            assert.equal(after.focus, Math.max(0, before.focus - 20));
            assert.equal(after.focusNotice.kind, 'door');
        }
        game.drainEvents();
    }
    const failed = game.getSnapshot();
    assert.ok(hits >= 5, 'separate contacts keep deducting focus');
    assert.equal(failed.focus, 0);
    assert.equal(failed.mode, 'focuslost');
    game.advance(2);
    assert.equal(game.getSnapshot().mode, 'dead');
    game.reset();
    assert.equal(game.getSnapshot().focus, 100);
    assert.equal(game.getSnapshot().doorHits, 0);
});

test('forward input alone keeps the opening chair pair rolling beyond its old blockage', () => {
    const game = createGame();
    game.startStage(2);
    game.setInput('right');
    let crossed = false;
    for (let i = 0; i < 120 * 8; i++) {
        game.step(dt);
        game.drainEvents();
        const state = game.getSnapshot();
        if (state.player.x > 650) { crossed = true; break; }
        assert.equal(state.mode, 'play');
    }
    assert.ok(crossed, 'pushing chairs must not pin the player around x485');
    const state = game.getSnapshot();
    assert.ok(state.furniture[0].x > 700);
    assert.ok(state.furniture[1].x > state.furniture[0].x);
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

test('speed telemetry settles to zero against a stationary cabinet despite wheel effort', () => {
    const game = createGame();
    game.startStage(2);
    drive(game, state => state.player.x > 2050);
    game.setInput('right');
    for (let i = 0; i < 120 * 8; i++) { game.step(dt); game.drainEvents(); }
    const before = game.getSnapshot();
    for (let i = 0; i < 120; i++) { game.step(dt); game.drainEvents(); }
    const after = game.getSnapshot();
    assert.equal(after.mode, 'play');
    assert.ok(Math.abs(after.player.x - before.player.x) < .1);
    assert.ok(after.player.vx > 10);
    assert.ok(after.actualSpeed < .1);
    game.pause();
    assert.equal(game.getSnapshot().actualSpeed, 0);
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
    game.setInput('brake');
    for (let i = 0; i < 100; i++) game.step(dt);
    assert.equal(game.getSnapshot().lessons.braked, true);
});

test('copier previews its shot and its first paper batch is safe', () => {
    const game = createGame();
    game.startStage(1);
    game.setInput('right');
    for (let i = 0; i < 1000 && game.getSnapshot().copier.burst === 0; i++) game.step(dt);
    let state = game.getSnapshot();
    assert.equal(state.copier.burst, 3);
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
