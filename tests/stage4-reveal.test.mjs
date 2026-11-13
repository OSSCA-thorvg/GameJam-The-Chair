import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createGame, createSky, STAGE_FOUR, skyStep, createRenderCtx, drawSky, drawOrbit, CLOUD_TONES, createSkyProjection, endingChair, endingHair, endingGlasses, skyCoursePlatform } = await loadSource(`
    export { createGame } from './src/game/game';
    export { createSky, STAGE_FOUR } from './src/game/stages/sky/data';
    export { skyStep } from './src/game/stages/sky/course/decide';
    export { createRenderCtx } from './src/render/context';
    export { drawSky } from './src/render/scene/sky';
    export { drawOrbit } from './src/render/scene/orbit';
    export { CLOUD_TONES } from './src/render/scene/cloud-art';
    export { createSkyProjection } from './src/render/scene/sky-projection';
    export { endingChair } from './src/render/scene/sky-ending-art';
    export { endingHair } from './src/render/scene/sky-player-hair';
    export { endingGlasses } from './src/render/scene/sky-player-glasses';
    export { skyCoursePlatform } from './src/render/scene/sky-course-art';
`);

test('the stage four billboard slogan fills its space without covering the portrait', () => {
    const renderLabels = (locale, width) => {
        const labels = [];
        let originX = 0, originY = 0;
        const lg = {
            save() {}, restore() {}, rotate() {},
            translate(x, y) { originX = x; originY = y; },
            measureText(text) {
                const ems = { '흔들리지 않는 기업': 7.7, '흔들리지': 4, '않는 기업': 3.25,
                    'UNSHAKEABLE INC.': 10, UNSHAKE: 5.2, 'ABLE INC.': 4.8 }[text];
                return { width: Number(this.font.match(/([\d.]+)px/)?.[1]) * ems };
            },
            strokeText() {},
            fillText(text, x, y) {
                const measured = this.measureText(text).width;
                labels.push({ text, fontSize: Number(this.font.match(/([\d.]+)px/)?.[1]),
                    left: originX + x - measured / 2, right: originX + x + measured / 2, y: originY + y });
            },
        };
        const ctx = createRenderCtx({}, lg);
        ctx.locale = locale;
        ctx.scale = 1 / 1.12;
        skyCoursePlatform(ctx, { id: 'last-sign', kind: 'sign', x: 0, y: 0, width, angle: 0 });
        return labels;
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

test('the rear hair has a swept crown and a tapered nape instead of a rectangular silhouette', () => {
    const view = createSkyProjection(1000, 510, 1);
    endingHair(view, 0);
    const commands = view.commands();
    const vertices = commands.flatMap(command => command.v);
    const left = Math.min(...vertices.map(([x]) => x)), right = Math.max(...vertices.map(([x]) => x));
    const top = Math.min(...vertices.map(([, y]) => y)), bottom = Math.max(...vertices.map(([, y]) => y));
    const edge = (x, end) => vertices.filter(([px]) => Math.abs(px - x) < (right - left) * .08)
        .map(([, y]) => y).reduce((best, y) => end === 'top' ? Math.min(best, y) : Math.max(best, y),
            end === 'top' ? Infinity : -Infinity);
    assert.ok(edge(left, 'top') > top + 3 && edge(right, 'top') > top + 3, 'crown slopes down toward both temples');
    assert.ok(Math.abs(edge(left, 'top') - edge(right, 'top')) > .5, 'swept crown is not symmetric');
    assert.ok(edge(left, 'bottom') < bottom - 2 && edge(right, 'bottom') < bottom - 2, 'nape tapers at both sides');
    assert.ok(commands.some(command => command.c === '#505968'), 'rear surface carries a small swept lock');
    for (const [x, y] of vertices) assert.ok(Number.isFinite(x) && Number.isFinite(y));
});

test('the 3D side view retains the ordinary player’s blue lens size and reflection', () => {
    const view = createSkyProjection(1000, 510, 0);
    endingGlasses(view, 0);
    const commands = view.commands();
    const panes = commands.filter(command => command.c === '#83c8e4');
    assert.equal(panes.length, 1, 'only the outward-facing side lens is drawn');
    const lens = panes[0].v;
    const width = Math.max(...lens.map(([x]) => x)) - Math.min(...lens.map(([x]) => x));
    const height = Math.max(...lens.map(([, y]) => y)) - Math.min(...lens.map(([, y]) => y));
    assert.ok(width > 15 && height > 6, 'blue lens is a readable face rather than a thin edge');
    assert.ok(Math.abs(width / height - 9 / 4) < .15, 'matches the original side lens proportions');
    assert.ok(commands.some(command => command.c === '#bfe6ef'), 'keeps the original pale reflection');
    assert.ok(commands.some(command => command.c === '#446d82'), 'eye remains visible on the blue lens');
});

test('blue lenses stay readable during the turn and do not face through the back of the head', () => {
    for (const orbit of [0, .25, .5]) {
        const view = createSkyProjection(1000, 510, orbit);
        endingGlasses(view, 0);
        const pane = view.commands().find(command => command.c === '#83c8e4');
        assert.ok(pane, `lens remains visible at orbit ${orbit}`);
        const area = Math.abs(pane.v.reduce((sum, p, i) => {
            const next = pane.v[(i + 1) % pane.v.length];
            return sum + p[0] * next[1] - next[0] * p[1];
        }, 0)) / 2;
        assert.ok(area > 30, 'turning lens retains a blue surface');
    }
    const rear = createSkyProjection(1000, 510, 1);
    endingGlasses(rear, 0);
    assert.ok(!rear.commands().some(command => command.c === '#83c8e4'), 'side lens back faces are culled');
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
test('the departure leaves scenery behind before the quiet side view and is seekable', () => {
    const scenery = age => revealFrame('reveal', age).filter(command => command.layer?.key === 'sky-ending-departure');
    const start = scenery(0), leaving = scenery(STAGE_FOUR.reveal.settle * .4);
    assert.ok(start.length > 0 && leaving.length > 0);
    assert.ok(leaving[0].layer.opacity < start[0].layer.opacity);
    const bounds = commands => {
        const points = commands.flatMap(command => command.v);
        return { right: Math.max(...points.map(([x]) => x)), bottom: Math.max(...points.map(([, y]) => y)) };
    };
    assert.ok(bounds(leaving).right < bounds(start).right, 'the ledge retreats behind the chair');
    assert.deepEqual(scenery(STAGE_FOUR.reveal.settle * .7), [], 'open sky remains before the camera turns');
    assert.deepEqual(scenery(0), start, 'backward seeking restores the departure scenery');
});

test('arrival spray shortens and settles into the existing chair animation', () => {
    const chair = (time, spray, arrival) => {
        const view = createSkyProjection(1000, 510, 0);
        endingChair(view, time, spray, arrival);
        return view.commands();
    };
    const plume = commands => commands.filter(command => typeof command.c === 'string' && command.c.startsWith('#f6e6df'));
    const bottom = commands => Math.max(...plume(commands).flatMap(command => [...command.v, ...command.curves]).map(point => point[1]));
    assert.ok(bottom(chair(0, 2.5, 0)) > bottom(chair(0, 1, 0)) + 30);
    assert.notDeepEqual(chair(.1, 1, 1), chair(.1, 1, 0), 'arrival initially shakes the chair');
    assert.deepEqual(revealFrame('reveal', 1).slice(-chair(1, 1, 0).length), chair(1, 1, 0),
        'arrival motion returns to the original animated model before the camera turns');
    assert.deepEqual(plume(revealFrame('reveal', 1)), plume(chair(1, 1, 0)));
});
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
