import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createSky, STAGE_FOUR, skyStep, createRenderCtx, drawSky, drawOrbit, CLOUD_TONES, createSkyProjection, endingChair, skyCoursePlatform } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createSky, STAGE_FOUR } from './src/game/stages/sky/data';
    export { skyStep } from './src/game/stages/sky/course/decide';
    export { createRenderCtx } from './src/render/context';
    export { drawSky } from './src/render/scene/sky';
    export { drawOrbit } from './src/render/scene/orbit';
    export { CLOUD_TONES } from './src/render/scene/cloud-art';
    export { createSkyProjection } from './src/render/scene/sky-projection';
    export { endingChair } from './src/render/scene/sky-ending-art';
    export { skyCoursePlatform } from './src/render/scene/sky-course-art';
`);

test('the stage four billboard slogan fills its space without covering the portrait', () => {
    const ems = { '흔들리지': 4, '않는 기업': 3.25, UNSHAKE: 5.2, 'ABLE INC.': 4.8 };
    const renderLabels = (locale, width) => {
        // Only measuring touches the label canvas; the copy itself is ThorVG Text in the command list.
        const lg = { measureText(text) { return { width: Number(this.font.match(/([\d.]+)px/)?.[1]) * ems[text] }; } };
        const ctx = createRenderCtx({}, lg);
        ctx.locale = locale;
        ctx.scale = 1 / 1.12;
        skyCoursePlatform(ctx, { id: 'last-sign', kind: 'sign', x: 0, y: 0, width, angle: 0 });
        return ctx.commands.filter(command => command.text).map(({ text }) => ({
            text: text.content, fontSize: text.size,
            left: text.x - text.size * ems[text.content] / 2, right: text.x + text.size * ems[text.content] / 2, y: text.y,
        }));
    };

    const ko = renderLabels('ko', 230);
    const en = renderLabels('en', 230);
    assert.deepEqual(ko.map(label => label.text), ['흔들리지', '않는 기업']);
    assert.deepEqual(en.map(label => label.text), ['UNSHAKE', 'ABLE INC.']);
    assert.ok(ko.every(label => label.fontSize >= 30), 'Korean stays large at the stage four camera scale');
    assert.ok(en.every(label => label.fontSize >= 25), 'English stays large at the stage four camera scale');
    for (const label of [...ko, ...en]) {
        assert.ok(label.left >= 14 / 1.12 - 1e-9, 'the slogan stays inside the left frame');
        assert.ok(label.right <= (230 - 66) / 1.12 + 1e-9, 'the slogan leaves room for the portrait');
    }
    assert.ok(ko[1].y > ko[0].y, 'the slogan uses the billboard height instead of shrinking into one line');
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

function renderFrame(stage, setup) {
    const game = createGame();
    game.startStage(stage);
    const state = structuredClone(game.getSnapshot());
    setup?.(state);
    const ctx = createRenderCtx({}, {});
    Object.assign(ctx, { state, p: state.player, mode: 'play', locale: 'en', W: 1000, H: 510, t: 0 });
    (stage === 4 ? drawSky : drawOrbit)(ctx);
    return ctx.commands;
}
const revealFrame = (phase, age) => renderFrame(4, state => Object.assign(state.sky, { phase, age }));
const hex = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
// Cloud bodies are the vertical gradients whose first stop is a cloud crown colour.
const cloudBodies = (commands, tone) => commands.filter(command =>
    Array.isArray(command.c?.stops) && command.c.stops[0][1].slice(0, 3).join() === hex(tone.top).join());

test('the ending clouds are bread clouds, not flat pale ovals', () => {
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    for (const [phase, age] of [['reveal', 0], ['reveal', settle + turn / 2], ['depth', 0], ['depth', hold]]) {
        const commands = revealFrame(phase, age);
        assert.ok(cloudBodies(commands, CLOUD_TONES.bread).length >= 5, `${phase} ${age}: bread clouds stay on screen`);
        // The old ending drew its clouds as flat ovals in these two colours (the spray shares the base colour).
        assert.ok(!commands.some(command => command.c === '#f6e6dfbe' || command.c === '#f6e6dfc3'));
    }
});

test('ending clouds are bread from the start and none vanishes while the camera turns', () => {
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    // Cloud bodies: linear crown-to-belly gradients whose underside fades out.
    const bodies = commands => commands.filter(command => Array.isArray(command.c?.stops) && !command.c.radius
        && command.c.stops.length === 3 && command.c.stops[2][1][3] === 0);
    const bread = hex(CLOUD_TONES.bread.top).join();
    let previous = 0;
    for (let at = 0; at <= settle + turn + hold; at += 1 / 30) {
        const turning = at < settle + turn;
        const clouds = bodies(revealFrame(turning ? 'reveal' : 'depth', turning ? at : at - settle - turn));
        assert.deepEqual(clouds.map(command => command.c.stops[0][1].slice(0, 3).join()).filter(crown => crown !== bread), [],
            `every cloud is bread at ${at.toFixed(2)} s`);
        assert.ok(clouds.length >= previous, `no cloud disappears at ${at.toFixed(2)} s`);
        previous = clouds.length;
    }
});

test('the last ending frame shows the same bread clouds as the first frame of stage five', () => {
    const ending = cloudBodies(revealFrame('depth', STAGE_FOUR.reveal.hold), CLOUD_TONES.bread);
    const stageFive = cloudBodies(renderFrame(5), CLOUD_TONES.bread);
    assert.ok(stageFive.length >= 5);
    assert.deepEqual(ending.map(({ v, curves }) => ({ v, curves })), stageFive.map(({ v, curves }) => ({ v, curves })));
});
