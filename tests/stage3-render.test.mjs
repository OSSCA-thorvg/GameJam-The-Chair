import assert from 'node:assert/strict';
import test from 'node:test';
import { driveStageThree } from './support/stage3-route.mjs';
import { bundled } from './support/load.mjs';
const { createGame, createRenderCtx, drawRooftop, drawCloudStart, STAGE_THREE, STAGE_FOUR } = await bundled({ stdin: { contents: `export { createGame } from './src/game/game'; export { createRenderCtx } from './src/render/context'; export { drawRooftop } from './src/render/scene/rooftop'; export { drawCloudStart } from './src/render/scene/clouds'; export { STAGE_THREE } from './src/game/stages/rooftop/data'; export { STAGE_FOUR } from './src/game/stages/sky/data';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });

test('entrance replaces the falling chart with an employee board with an initially tidy row', () => {
    const game = createGame();
    game.startStage(3);
    const state = game.getSnapshot();
    for (const locale of ['en', 'ko']) for (const width of [540, 1000]) {
        const labels = [];
        const ctx = createRenderCtx({}, { fillText: (text, x, y) => labels.push({ text, x, y }) });
        Object.assign(ctx, { state, p: state.player, mode: state.mode, locale, VW: width, W: width });
        drawRooftop(ctx);
        assert.ok(labels.some(label => label.text === (locale === 'en' ? 'EMPLOYEES OF THE MONTH' : '이달의 우수사원')));
        assert.ok(labels.every(label => label.text !== 'JIN' && label.text !== '진'));
        const portraits = ctx.commands.filter(command => command.c === '#f4ecd7'
            && command.v.length === 4 && command.v[1][0] - command.v[0][0] === 40
            && command.v[2][1] - command.v[1][1] === 49);
        assert.deepEqual(portraits.map(command => command.v[0]), [[62, 118], [111, 118], [160, 118]]);
        assert.ok(!ctx.commands.some(command => command.layer?.key === 'sales-monitor-fall'));
        assert.ok(!ctx.commands.some(command => command.layer?.key === 'sales-monitor-flat'));
        const beam = ctx.commands.find(command => command.layer?.key === 'employee-board-light');
        assert.ok(beam && typeof beam.c !== 'string');
        assert.ok(Math.min(...beam.v.map(point => point[1])) < 82, 'light starts above the board');
        assert.ok(Math.max(...beam.v.map(point => point[1])) >= 210, 'light reaches the board bottom');
        assert.ok(ctx.commands.some(command => command.v.some(([x, y]) => x === -400 && y === -72)), 'entrance wall extends above the board and lamp');
    }
});

test('the shut door jolts only the player portrait into a drop and swing, with repeatable seeking', () => {
    const game = createGame();
    game.startStage(3);
    const frames = new Map([[0, game.getSnapshot()]]);
    for (let tick = 1; tick <= 600; tick++) {
        game.step();
        if ([132, 300, 318, 336, 360, 468, 540, 600].includes(tick)) frames.set(tick, game.getSnapshot());
    }
    const render = tick => {
        const state = frames.get(tick);
        const ctx = createRenderCtx({}, { fillText() {} });
        Object.assign(ctx, { state, p: state.player, mode: state.mode });
        drawRooftop(ctx);
        return ctx.commands.filter(command => command.c === '#f4ecd7' && command.v.length === 4
            && Math.abs(Math.hypot(command.v[1][0] - command.v[0][0], command.v[1][1] - command.v[0][1]) - 40) < 1e-8
            && Math.abs(Math.hypot(command.v[2][0] - command.v[1][0], command.v[2][1] - command.v[1][1]) - 49) < 1e-8);
    };
    const angle = portraits => {
        const [a, b] = portraits[2].v;
        return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    };
    const start = render(0);
    assert.equal(angle(start), 0);
    for (const tick of [132, 300]) assert.deepEqual(render(tick), start, 'photo stays in the row until the door shuts');
    assert.notEqual(angle(render(318)), 0, 'door impact rattles the photo');
    const pivotY = portraits => {
        const [a, b] = portraits[2].v;
        return (a[1] + b[1]) / 2 + Math.cos(angle(portraits) * Math.PI / 180);
    };
    const falling = render(336);
    assert.ok(pivotY(falling) > 119 && pivotY(falling) < 154, 'photo falls out of the row');
    assert.ok(pivotY(render(360)) > 154, 'photo bounces when caught');
    assert.ok(angle(render(468)) > 40, 'photo swings past its resting angle');
    for (const tick of [540, 600]) {
        const tilted = render(tick);
        assert.ok(Math.abs(angle(tilted) - 40) < 1e-8);
        assert.deepEqual(tilted.slice(0, 2), start.slice(0, 2), 'other employees stay upright');
    }
    assert.deepEqual(render(0), start);
    assert.deepEqual(render(336), falling);
});

test('rooftop renders the live course and first flight in both languages and narrow views', () => {
    const game = createGame(); game.startStage(3);
    const frames = new Map([['room', game.getSnapshot()]]);
    const ascentStartY = STAGE_THREE.graph.points.at(-1).y - 28;
    const ascentHalfY = (ascentStartY + STAGE_FOUR.arrivalY) / 2;
    driveStageThree(game, state => state.stage === 4, (state, phase) => {
        if (state.stage === 4) {
            frames.set('bread-clouds', { ...state, time: 2.6 });
        }
        if (state.hasExtinguisher && !frames.has('pickup')) frames.set('pickup', state);
        if (phase === 8 && !frames.has('shaft')) frames.set('shaft', state);
        if (state.ductReaction.kind === 'reacting') {
            const age = state.ductReaction.age;
            const name = age < .12 ? 'inhale' : age < .2 ? 'twitch' : 'sneeze';
            if (!frames.has(name)) frames.set(name, state);
        }
        if (state.checkpoint === 4 && !frames.has('upper')) frames.set('upper', state);
        if (state.firstFlight.kind === 'flight') {
            if (!frames.has('ascent-start')) frames.set('ascent-start', { ...state, player: { ...state.player, y: ascentStartY } });
            if (!frames.has('ascent-half')) frames.set('ascent-half', { ...state, player: { ...state.player, y: ascentHalfY } });
            if (state.firstFlight.age > 1.4 && !frames.has('flight')) frames.set('flight', state);
        }
    });
    assert.equal(frames.size, 11);
    for (const [name, state] of frames) for (const locale of ['en', 'ko']) for (const width of [540, 1000]) {
        const labels = [];
        const ctx = createRenderCtx({}, { fillText: text => labels.push(text) });
        Object.assign(ctx, { state, p: state.player, mode: state.mode, locale, t: state.time,
            cam: Math.max(0, Math.min(state.player.x - width * .35, state.level.length - width)),
            vertical: Math.max(0, 330 - state.player.y), VW: width, W: width, H: 510,
        });
        if (state.stage === 4) drawCloudStart(ctx);
        else drawRooftop(ctx);
        assert.ok(ctx.commands.some(command => typeof command.c !== 'string'), 'ThorVG retains gradient fills');
        const gradientHas = rgb => ctx.commands.some(command => command.c && typeof command.c !== 'string'
            && command.c.stops.some(([, color]) => rgb.every((channel, index) => color[index] === channel)));
        if (name === 'ascent-start') assert.ok(gradientHas([253, 248, 239]), 'the ascent starts with the stage-three cloud colour');
        if (name === 'ascent-half') assert.ok(gradientHas([251, 233, 190]), 'the cloud colour changes gradually halfway up');
        if (name === 'bread-clouds') assert.ok(gradientHas([248, 217, 141]), 'the transition ends at golden bread');
        if (state.stage === 3) assert.ok(ctx.commands.some(command => command.curves?.length), 'rooftop retains curved effects');
        for (const command of ctx.commands) {
            for (const point of [...command.v, ...(command.curves ?? [])]) assert.ok(point.every(Number.isFinite));
            if (command.c && typeof command.c !== 'string') assert.ok(command.c.stops.every(([, color]) => color.every(Number.isFinite)));
        }
        const [, playerY] = ctx.screenPoint(state.player.x, state.player.y);
        assert.ok(playerY > 120 && playerY < 450, `${name}: chair remains in view`);
        for (const label of labels) assert.doesNotMatch(label, /[←→↑↓↗↖]/);
        if (name === 'pickup') assert.ok(labels.includes('Space'));
        if (locale === 'en') for (const label of labels) assert.doesNotMatch(label, /[가-힣]/);
        if (name === 'flight') assert.ok(labels.every(label => !/Wi-Fi|와이파이/.test(label)));
    }
});
