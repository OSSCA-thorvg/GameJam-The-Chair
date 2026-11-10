import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { driveStageThree } from './stage3-route.mjs';
const bundle = await build({ stdin: { contents: `export { createGame } from './src/game/game'; export { createRenderCtx } from './src/render/context'; export { drawRooftop } from './src/render/scene/rooftop'; export { drawCloudStart } from './src/render/scene/clouds';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { createGame, createRenderCtx, drawRooftop, drawCloudStart } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('rooftop renders the live course and first flight in both languages and narrow views', () => {
    const game = createGame(); game.startStage(3);
    const frames = new Map([['room', game.getSnapshot()]]);
    driveStageThree(game, state => state.stage === 4, (state, phase) => {
        if (state.stage === 4) frames.set('cloud-entry', state);
        if (state.hasExtinguisher && !frames.has('pickup')) frames.set('pickup', state);
        if (phase === 8 && !frames.has('shaft')) frames.set('shaft', state);
        if (state.ductReaction.kind === 'reacting') {
            const age = state.ductReaction.age;
            const name = age < .12 ? 'inhale' : age < .2 ? 'twitch' : 'sneeze';
            if (!frames.has(name)) frames.set(name, state);
        }
        if (state.checkpoint === 3 && !frames.has('upper')) frames.set('upper', state);
        if (state.firstFlight.kind === 'flight' && state.firstFlight.age > 1.4 && !frames.has('flight')) frames.set('flight', state);
    });
    assert.equal(frames.size, 9);
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
        if (state.stage === 3) assert.ok(ctx.commands.some(command => command.curves?.length), 'rooftop retains curved effects');
        for (const command of ctx.commands) {
            for (const point of [...command.v, ...(command.curves ?? [])]) assert.ok(point.every(Number.isFinite));
            if (typeof command.c !== 'string') assert.ok(command.c.stops.every(([, color]) => color.every(Number.isFinite)));
        }
        const [, playerY] = ctx.screenPoint(state.player.x, state.player.y);
        assert.ok(playerY > 120 && playerY < 450, `${name}: chair remains in view`);
        for (const label of labels) assert.doesNotMatch(label, /[←→↑↓↗↖]/);
        if (name === 'pickup') assert.ok(labels.includes('Space'));
        if (locale === 'en') for (const label of labels) assert.doesNotMatch(label, /[가-힣]/);
        if (name === 'flight') assert.ok(labels.every(label => !/Wi-Fi|와이파이/.test(label)));
    }
});
