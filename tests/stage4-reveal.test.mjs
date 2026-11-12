import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createSky, STAGE_FOUR, skyStep, createRenderCtx, drawSky, createSkyProjection, endingChair, skyCoursePlatform } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createSky, STAGE_FOUR } from './src/game/stages/sky/data';
    export { skyStep } from './src/game/stages/sky/course/decide';
    export { createRenderCtx } from './src/render/context';
    export { drawSky } from './src/render/scene/sky';
    export { createSkyProjection } from './src/render/scene/sky-projection';
    export { endingChair } from './src/render/scene/sky-ending-art';
    export { skyCoursePlatform } from './src/render/scene/sky-course-art';
`);

test('the stage four billboard slogan is large enough to read', () => {
    const labels = [];
    const lg = {
        save() {}, restore() {}, translate() {}, rotate() {},
        fillText(text) { labels.push({ text, font: this.font }); },
    };
    const ctx = createRenderCtx({}, lg);
    ctx.locale = 'ko';
    skyCoursePlatform(ctx, { id: 'last-sign', kind: 'sign', x: 0, y: 0, width: 230, angle: 0 });
    assert.deepEqual(labels, [{ text: '흔들리지 않는 기업', font: '16px system-ui,sans-serif' }]);
});

test('the ending settles before turning and finishes on its timer regardless of held movement', () => {
    const input = {
        sky: { ...createSky(), phase: 'reveal' },
        p: { x: 5300, y: -2338, vx: 70, vy: 0, a: .1, w: 0 },
        ground: false, coyote: 0, jumpQ: 0, checkpoint: 3,
        time: 0, direction: 0, length: 6100,
        sprayBurst: 0, sprayDir: { x: .7, y: .7 },
    };
    const beforeTurn = skyStep({ ...input, sky: { ...input.sky, age: STAGE_FOUR.reveal.settle - .1 } }, 1 / 120);
    assert.equal(beforeTurn.sky.phase, 'reveal');
    assert.equal(beforeTurn.won, false);
    const reading = STAGE_FOUR.reveal.settle + STAGE_FOUR.reveal.turn - .004;
    const revealed = skyStep({ ...input, sky: { ...input.sky, age: reading } }, 1 / 120);
    const held = skyStep({ ...input, direction: 1, sky: { ...input.sky, age: reading } }, 1 / 120);
    assert.deepEqual(held, revealed);
    assert.equal(revealed.sky.phase, 'depth');
    assert.equal(revealed.won, false);
    const end = skyStep({ ...input, sky: { ...revealed.sky, age: STAGE_FOUR.reveal.hold } }, 1 / 120);
    assert.equal(end.won, true);
    assert.equal(input.sky.age, 0);
});

test('the ending draws only the chair and sky without slogans at every camera phase', () => {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    for (const locale of ['en', 'ko']) for (const width of [320, 1000]) {
        for (const [phase, age] of [['reveal', 1], ['reveal', 5], ['depth', 0], ['depth', 3]]) {
            const state = structuredClone(base);
            Object.assign(state.sky, { phase, age });
            const labels = [], transforms = [];
            const ctx = createRenderCtx({}, {
                save() {}, restore() {},
                transform(...matrix) { transforms.push(matrix); },
                fillText(text) { labels.push(text); },
            });
            Object.assign(ctx, { state, p: state.player, mode: 'play', locale, W: width, H: 510 });
            const before = structuredClone(state);
            drawSky(ctx);
            assert.deepEqual(state, before, 'cinematic rendering leaves gameplay untouched');
            assert.deepEqual(labels, []);
            assert.deepEqual(transforms, []);
            assert.ok(ctx.commands.length > 100);
            for (const command of ctx.commands) {
                for (const point of [...command.v, ...(command.curves ?? [])]) assert.ok(point.every(Number.isFinite));
            }
        }
    }
});

test('the camera orbits from side to back while keeping the chair in frame', () => {
    for (const width of [320, 1000]) for (const orbit of [0, .25, .5, .75, 1]) {
        const view = createSkyProjection(width, 510, orbit);
        endingChair(view, 2);
        const vertices = view.commands().flatMap(command => command.v);
        assert.ok(vertices.length > 100);
        assert.ok(vertices.every(([x, y]) => x > 0 && x < width && y > 0 && y < 510));
    }
    const side = createSkyProjection(1000, 510, 0);
    const back = createSkyProjection(1000, 510, 1);
    const sideSeat = Math.abs(side.project([-39, 0, -28])[0] - side.project([-39, 0, 28])[0]);
    const backSeat = Math.abs(back.project([-39, 0, -28])[0] - back.project([-39, 0, 28])[0]);
    assert.ok(backSeat > sideSeat * 5, 'the full width of the backrest becomes visible');
});

test('the rotating illustration keeps the original hair silhouette and smooth round details', () => {
    const view = createSkyProjection(1000, 510, 0);
    endingChair(view, 2);
    const commands = view.commands();
    const hair = commands.find(command => command.c === '#3c424f' && command.v.length > 4);
    assert.ok(hair, 'the concave hair outline stays filled instead of disappearing during culling');
    const area = Math.abs(hair.v.reduce((sum, p, i) => {
        const next = hair.v[(i + 1) % hair.v.length];
        return sum + p[0] * next[1] - next[0] * p[1];
    }, 0)) / 2;
    assert.ok(area > 200);
    assert.ok(commands.filter(command => command.curves?.length === 4).length >= 10, 'casters and spray use smooth curves');
});

test('the crown stays covered by hair throughout the orbit', () => {
    const covers = ([x, y], vertices) => {
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const a = vertices[i], b = vertices[j];
            if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
        }
        return inside;
    };
    for (let frame = 0; frame <= 12; frame++) {
        const view = createSkyProjection(1000, 510, frame / 12);
        endingChair(view, 0);
        const commands = view.commands();
        for (const point of [[-4, 54, 8], [-4, 58, 8], [0, 58, 8]]) {
            const screen = view.project(point);
            const visible = commands.filter(command => command.v.length > 2 && covers(screen, command.v)).at(-1);
            assert.ok(visible, `the crown is filled at orbit ${frame}/12`);
            assert.ok(parseInt(visible.c.slice(1, 3), 16) < 128, `skin must not cover the hair at orbit ${frame}/12`);
        }
    }
});
