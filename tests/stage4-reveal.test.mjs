import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const {
    SKY_DEPARTURE,
    REVEAL_DURATION,
    revealChairOrbit,
    createGame,
    createSky,
    STAGE_FOUR,
    skyStep,
    createRenderCtx,
    drawSky,
    drawOrbit,
    CLOUD_TONES,
    createSkyProjection,
    endingChair,
    endingHair,
    endingGlasses,
    skyCoursePlatform,
} = await loadSource(`
    export { createGame } from './src/game/game';
    export { createSky, STAGE_FOUR } from './src/game/stages/sky/data';
    export { skyStep } from './src/game/stages/sky/course/decide';
    export { createRenderCtx } from './tests/support/render-context';
    export { drawSky } from './src/render/scene/sky';
    export { drawOrbit } from './src/render/scene/orbit';
    export { CLOUD_TONES } from './src/render/scene/cloud-art';
    export { createSkyProjection } from './src/render/scene/sky-projection';
    export { SKY_DEPARTURE, REVEAL_DURATION, revealChairOrbit } from './src/render/scene/sky-camera';
    export { endingChair } from './src/render/scene/sky-ending-art';
    export { endingHair } from './src/render/scene/sky-player-hair';
    export { endingGlasses } from './src/render/scene/sky-player-glasses';
    export { skyCoursePlatform } from './src/render/scene/sky-course-art';
`);

test('the stage four billboard slogan fills its space without covering the portrait', () => {
    const ems = {
        흔들리지: 4,
        '않는 기업': 3.25,
        UNSHAKE: 5.2,
        'ABLE INC.': 4.8,
    };
    const renderLabels = (locale, width) => {
        const bg = {
            measureText(text) {
                return {
                    width:
                        Number(this.font.match(/([\d.]+)px/)?.[1]) * ems[text],
                };
            },
        };
        const ctx = createRenderCtx(bg);
        ctx.locale = locale;
        ctx.scale = 1 / 1.12;
        skyCoursePlatform(ctx, {
            id: 'last-sign',
            kind: 'sign',
            x: 0,
            y: 0,
            width,
            angle: 0,
        });
        return ctx.commands
            .filter((command) => command.text)
            .map(({ text }) => ({
                text: text.content,
                fontSize: text.size,
                left: text.x - (text.size * ems[text.content]) / 2,
                right: text.x + (text.size * ems[text.content]) / 2,
                y: text.y,
            }));
    };

    const ko = renderLabels('ko', 230);
    const en = renderLabels('en', 230);
    assert.deepEqual(
        ko.map((label) => label.text),
        ['흔들리지', '않는 기업'],
    );
    assert.deepEqual(
        en.map((label) => label.text),
        ['UNSHAKE', 'ABLE INC.'],
    );
    assert.ok(
        ko.every((label) => label.fontSize >= 30),
        'Korean stays large at the stage four camera scale',
    );
    assert.ok(
        en.every((label) => label.fontSize >= 25),
        'English stays large at the stage four camera scale',
    );
    for (const label of [...ko, ...en]) {
        assert.ok(
            label.left >= 14 / 1.12 - 1e-9,
            'the slogan stays inside the left frame',
        );
        assert.ok(
            label.right <= (230 - 66) / 1.12 + 1e-9,
            'the slogan leaves room for the portrait',
        );
    }
    assert.ok(
        ko[1].y > ko[0].y,
        'the slogan uses the billboard height instead of shrinking into one line',
    );
});

test('the ending settles before turning and finishes on its timer regardless of held movement', () => {
    const input = {
        sky: { ...createSky(), phase: 'reveal' },
        p: { x: 5300, y: -2338, vx: 70, vy: 0, a: 0.1, w: 0 },
        ground: false,
        coyote: 0,
        jumpQ: 0,
        checkpoint: 3,
        time: 0,
        direction: 0,
        length: 6100,
        sprayBurst: 0,
        sprayDir: { x: 0.7, y: 0.7 },
    };
    const beforeTurn = skyStep(
        {
            ...input,
            sky: { ...input.sky, age: STAGE_FOUR.reveal.settle - 0.1 },
        },
        1 / 120,
    );
    assert.equal(beforeTurn.sky.phase, 'reveal');
    assert.equal(beforeTurn.won, false);
    const reading = STAGE_FOUR.reveal.settle + STAGE_FOUR.reveal.turn - 0.004;
    const revealed = skyStep(
        { ...input, sky: { ...input.sky, age: reading } },
        1 / 120,
    );
    const held = skyStep(
        { ...input, direction: 1, sky: { ...input.sky, age: reading } },
        1 / 120,
    );
    assert.deepEqual(held, revealed);
    assert.equal(revealed.sky.phase, 'depth');
    assert.equal(revealed.won, false);
    const end = skyStep(
        { ...input, sky: { ...revealed.sky, age: STAGE_FOUR.reveal.hold } },
        1 / 120,
    );
    assert.equal(end.won, true);
    assert.equal(input.sky.age, 0);
});

test('the ending draws no slogans, only the departing promotion flag and the attendance line', () => {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    for (const locale of ['en', 'ko']) {
        for (const width of [320, 1000]) {
            const { hold } = STAGE_FOUR.reveal;
            for (const [phase, age] of /** @type {const} */ ([
                ['reveal', 1],
                ['reveal', 5],
                ['depth', 0],
                ['depth', hold * 0.3],
                ['depth', hold - 0.1],
            ])) {
                const state = structuredClone(base);
                Object.assign(state.sky, { phase, age });
                const transforms = [];
                const ctx = createRenderCtx({
                    save() {},
                    restore() {},
                    transform(...matrix) {
                        transforms.push(matrix);
                    },
                });
                Object.assign(ctx, {
                    state,
                    player: state.player,
                    mode: 'play',
                    locale,
                    W: width,
                    H: 510,
                });
                const before = structuredClone(state);
                drawSky(ctx);
                assert.deepEqual(
                    state,
                    before,
                    'cinematic rendering leaves gameplay untouched',
                );
                const expected =
                    phase === 'reveal' && age < 2
                        ? [locale === 'ko' ? '승진' : 'PROMOTED']
                        : phase === 'depth' && age > hold - 1.2
                          ? [
                                locale === 'ko'
                                    ? '근태 확인됨.'
                                    : 'Attendance confirmed.',
                            ]
                          : [];
                assert.deepEqual(
                    ctx.commands
                        .filter((command) => command.text)
                        .map((command) => command.text.content),
                    expected,
                );
                assert.deepEqual(transforms, []);
                assert.ok(ctx.commands.length > 100);
                for (const command of ctx.commands) {
                    for (const point of [
                        ...command.points,
                        ...(command.curves ?? []),
                    ]) {
                        assert.ok(point.every(Number.isFinite));
                    }
                }
            }
        }
    }
});

test('the camera orbits from side to back while keeping the chair in frame', () => {
    for (const width of [320, 1000]) {
        for (const orbit of [0, 0.25, 0.5, 0.75, 1]) {
            const view = createSkyProjection(width, 510, orbit);
            endingChair(view, 2);
            const vertices = view
                .commands()
                .flatMap((command) => command.points);
            assert.ok(vertices.length > 100);
            assert.ok(
                vertices.every(
                    ([x, y]) => x > 0 && x < width && y > 0 && y < 510,
                ),
            );
        }
    }
    const side = createSkyProjection(1000, 510, 0);
    const back = createSkyProjection(1000, 510, 1);
    const sideSeat = Math.abs(
        side.project([-39, 0, -28])[0] - side.project([-39, 0, 28])[0],
    );
    const backSeat = Math.abs(
        back.project([-39, 0, -28])[0] - back.project([-39, 0, 28])[0],
    );
    assert.ok(
        backSeat > sideSeat * 5,
        'the full width of the backrest becomes visible',
    );
});

test('the rotating illustration keeps the original hair silhouette and smooth round details', () => {
    const view = createSkyProjection(1000, 510, 0);
    endingChair(view, 2);
    const commands = view.commands();
    const hair = commands.find(
        (command) => command.fill === '#3c424f' && command.points.length > 4,
    );
    assert.ok(
        hair,
        'the concave hair outline stays filled instead of disappearing during culling',
    );
    const area =
        Math.abs(
            hair.points.reduce((sum, p, i) => {
                const next = hair.points[(i + 1) % hair.points.length];
                return sum + p[0] * next[1] - next[0] * p[1];
            }, 0),
        ) / 2;
    assert.ok(area > 200);
    assert.ok(
        commands.filter((command) => command.curves?.length === 4).length >= 10,
        'casters and spray use smooth curves',
    );
});

test('the crown stays covered by hair throughout the orbit', () => {
    const covers = ([x, y], vertices) => {
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const a = vertices[i],
                b = vertices[j];
            if (
                a[1] > y !== b[1] > y &&
                x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
            ) {
                inside = !inside;
            }
        }
        return inside;
    };
    for (let frame = 0; frame <= 12; frame++) {
        const view = createSkyProjection(1000, 510, frame / 12);
        endingChair(view, 0);
        const commands = view.commands();
        for (const point of /** @type {const} */ ([
            [-4, 54, 8],
            [-4, 58, 8],
            [0, 58, 8],
        ])) {
            const screen = view.project(point);
            const visible = commands
                .filter(
                    (command) =>
                        command.points.length > 2 &&
                        covers(screen, command.points),
                )
                .at(-1);
            assert.ok(visible, `the crown is filled at orbit ${frame}/12`);
            assert.ok(
                parseInt(visible.fill.slice(1, 3), 16) < 128,
                `skin must not cover the hair at orbit ${frame}/12`,
            );
        }
    }
});

test('the rear hair has a swept crown and a tapered nape instead of a rectangular silhouette', () => {
    const view = createSkyProjection(1000, 510, 1);
    endingHair(view, 0);
    const commands = view.commands();
    const vertices = commands.flatMap((command) => command.points);
    const left = Math.min(...vertices.map(([x]) => x)),
        right = Math.max(...vertices.map(([x]) => x));
    const top = Math.min(...vertices.map(([, y]) => y)),
        bottom = Math.max(...vertices.map(([, y]) => y));
    const edge = (x, end) =>
        vertices
            .filter(([px]) => Math.abs(px - x) < (right - left) * 0.08)
            .map(([, y]) => y)
            .reduce(
                (best, y) =>
                    end === 'top' ? Math.min(best, y) : Math.max(best, y),
                end === 'top' ? Infinity : -Infinity,
            );
    assert.ok(
        edge(left, 'top') > top + 3 && edge(right, 'top') > top + 3,
        'crown slopes down toward both temples',
    );
    assert.ok(
        Math.abs(edge(left, 'top') - edge(right, 'top')) > 0.5,
        'swept crown is not symmetric',
    );
    assert.ok(
        edge(left, 'bottom') < bottom - 2 && edge(right, 'bottom') < bottom - 2,
        'nape tapers at both sides',
    );
    assert.ok(
        commands.some((command) => command.fill === '#505968'),
        'rear surface carries a small swept lock',
    );
    for (const [x, y] of vertices) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
    }
});

const isArm = (color) =>
    typeof color === 'string' &&
    color.length >= 7 &&
    [1, 3, 5].every(
        (i, k) =>
            Math.abs(
                parseInt(color.slice(i, i + 2), 16) - [0x3a, 0x41, 0x4b][k],
            ) <= 4,
    );
const lensPanes = (commands) =>
    commands.filter((command) => command.fill === '#83c8e4');
const lensBounds = (pane) => {
    const xs = pane.points.map(([x]) => x),
        ys = pane.points.map(([, y]) => y);
    return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
    };
};

test('the 3D glasses have lenses on the front of the face only: none on the sides', () => {
    const side = createSkyProjection(1000, 510, 0);
    endingGlasses(side, 0);
    assert.deepEqual(
        lensPanes(side.commands()),
        [],
        'no lens surface painted on the side of the face',
    );
    const blue = side
        .commands()
        .filter(
            (command) =>
                typeof command.fill === 'string' &&
                command.fill.length >= 7 &&
                [1, 3, 5].every(
                    (i, k) =>
                        Math.abs(
                            parseInt(command.fill.slice(i, i + 2), 16) -
                                [0x83, 0xc8, 0xe4][k],
                        ) <= 12,
                ),
        );
    assert.ok(blue.length > 0, 'the lens shows side on as a line');
    const spread = blue.flatMap((command) => command.points);
    const width =
        Math.max(...spread.map(([x]) => x)) -
        Math.min(...spread.map(([x]) => x));
    const height =
        Math.max(...spread.map(([, y]) => y)) -
        Math.min(...spread.map(([, y]) => y));
    assert.ok(
        height > width * 2.5,
        `a thin upright line, not a surface (${width.toFixed(1)} by ${height.toFixed(1)})`,
    );
    assert.ok(
        side.commands().some((command) => isArm(command.fill)),
        'the arm runs back along the side of the head',
    );
    const front = createSkyProjection(1000, 510, 3, { zoom: 3 });
    endingGlasses(front, 0);
    const panes = lensPanes(front.commands())
        .map(lensBounds)
        .sort((a, b) => a.left - b.left);
    assert.equal(panes.length, 2, 'two lenses');
    assert.ok(panes[0].right < panes[1].left, 'side by side, not overlapping');
    for (const pane of panes) {
        assert.ok(
            pane.width > pane.height * 0.9 && pane.height > 40,
            `each a large lens (${pane.width.toFixed(0)} by ${pane.height.toFixed(0)})`,
        );
    }
    assert.ok(
        front.commands().some((command) => command.fill === '#bfe6ef'),
        'keeps the pale reflection',
    );
    assert.equal(
        front.commands().filter((command) => command.fill === '#446d82').length,
        2,
        'an eye behind each lens',
    );
});

test('blue lenses never number more than two while turning, and do not face through the back of the head', () => {
    for (const orbit of [0, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]) {
        const view = createSkyProjection(1000, 510, orbit);
        endingGlasses(view, 0);
        assert.ok(
            lensPanes(view.commands()).length <= 2,
            `at most two lenses at orbit ${orbit}`,
        );
    }
    const quarter = createSkyProjection(1000, 510, 3.5);
    endingGlasses(quarter, 0);
    assert.ok(
        lensPanes(quarter.commands()).length > 0,
        'a three-quarter front view shows the lenses',
    );
    const rear = createSkyProjection(1000, 510, 1);
    endingGlasses(rear, 0);
    assert.deepEqual(
        lensPanes(rear.commands()),
        [],
        'lens back faces are culled from behind',
    );
});

function renderFrame(stage, setup) {
    const game = createGame();
    game.startStage(stage);
    const state = structuredClone(game.getSnapshot());
    setup?.(state);
    const ctx = createRenderCtx({});
    Object.assign(ctx, {
        state,
        player: state.player,
        mode: 'play',
        locale: 'en',
        W: 1000,
        H: 510,
        t: 0,
    });
    (stage === 4 ? drawSky : drawOrbit)(ctx);
    return ctx.commands;
}
const withoutBubble = (commands) =>
    commands.filter((command) => command.layer?.key !== 'attendance-bubble');
const revealFrame = (phase, age) =>
    renderFrame(4, (state) => Object.assign(state.sky, { phase, age }));
// Chair geometry drawn into the shared world camera picks up rounding noise
// from its placement transform.
const near = (actual, expected, path = '') => {
    if (typeof expected === 'number') {
        return assert.ok(
            Math.abs(actual - expected) < 1e-6,
            `${path}: ${actual} vs ${expected}`,
        );
    }
    if (expected === null || typeof expected !== 'object') {
        return assert.equal(actual, expected, path);
    }
    assert.equal(
        Object.keys(actual).length,
        Object.keys(expected).length,
        path,
    );
    for (const key of Object.keys(expected)) {
        near(actual[key], expected[key], `${path}.${key}`);
    }
};
const bounds = (commands) => {
    const points = commands.flatMap((command) => [
        ...command.points,
        ...(command.curves ?? []).map((curve) => curve.slice(-2)),
    ]);
    const xs = points.map(([x]) => x),
        ys = points.map(([, y]) => y);
    return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
    };
};
test('the reveal turns steadily from the side to behind the chair, keeping it centred in the shared camera', () => {
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    const side = createSkyProjection(1000, 510, 0);
    endingChair(side, settle);
    const model = side.commands();
    near(
        withoutBubble(revealFrame('reveal', settle)).slice(-model.length),
        model,
    );
    assert.ok(
        model.some(
            (command) =>
                command.fill === '#50606a' ||
                command.fill === '#3a414b' ||
                isArm(command.fill),
        ),
        'the glasses remain visible',
    );
    let previous = -1;
    for (let at = settle; at <= settle + turn + hold; at += 0.5) {
        previous =
            (assert.ok(revealChairOrbit(at, settle) >= previous),
            revealChairOrbit(at, settle));
    }
    assert.ok(
        Math.abs(revealChairOrbit(settle + turn, settle) - 1) < 1e-9,
        'behind the chair once the turn is done',
    );
    for (const [phase, age] of /** @type {const} */ ([
        ['depth', 0],
        ['depth', hold],
    ])) {
        const rear = createSkyProjection(1000, 510, 1);
        endingChair(rear, settle + turn + age);
        const colours = new Set(rear.commands().map((command) => command.fill));
        const chair = bounds(
            withoutBubble(revealFrame(phase, age)).filter(
                (command) => colours.has(command.fill) && !command.layer,
            ),
        );
        const alone = bounds(rear.commands());
        assert.ok(
            Math.abs((chair.left + chair.right) / 2 - 500) < 30,
            'the chair stays centred',
        );
        const width = chair.right - chair.left,
            model = alone.right - alone.left;
        assert.ok(
            width <= model * 1.05 && width > model * 0.6,
            `at about the same size (${(width / model).toFixed(2)})`,
        );
    }
});

test('the watchers stay out of the flat side view and turn up, without fading, as the view turns into 3D', () => {
    const { settle, turn } = STAGE_FOUR.reveal;
    const watch = (phase, age) =>
        revealFrame(phase, age).filter(
            (command) =>
                !command.layer && ['#ff4a3a', '#5e1d1a'].includes(command.fill),
        );
    assert.equal(
        watch('reveal', settle * 0.9).length,
        0,
        'nothing in the 2D side view',
    );
    const early = watch('reveal', settle + turn * 0.3),
        late = watch('reveal', settle + turn * 0.8);
    assert.ok(
        early.length > 0 && late.length > early.length,
        'more cameras come into view as the turn goes on',
    );
    for (const commands of [early, late, watch('depth', 1)]) {
        assert.ok(
            commands.every((command) => command.fill.length === 7),
            'no fade',
        );
    }
    assert.ok(
        revealFrame('reveal', settle + turn - 0.1).some(
            (command) => command.layer?.key === 'orbit-beacon',
        ),
        'the far speck shows before stage five',
    );
});

test('the attendance bubble appears just before stage five and stays into its first moments', () => {
    const bubble = (commands) =>
        commands.filter(
            (command) => command.layer?.key === 'attendance-bubble',
        );
    assert.equal(
        bubble(revealFrame('reveal', 8)).length,
        0,
        'not while the chair is still gliding past the cameras',
    );
    assert.ok(
        bubble(revealFrame('depth', STAGE_FOUR.reveal.hold - 0.5)).length > 0,
        'up during the last moments of stage four',
    );
    assert.ok(
        bubble(renderFrame(5)).some(
            (command) => command.text?.content === 'Attendance confirmed.',
        ),
        'still up, words and all, when stage five starts',
    );
    assert.equal(
        bubble(
            renderFrame(5, (state) => {
                state.orbit.age = 4;
            }),
        ).length,
        0,
        'gone once stage five is under way',
    );
});

test('the departure leaves scenery behind before the quiet side view and is seekable', () => {
    const scenery = (age) =>
        revealFrame('reveal', age).filter(
            (command) => command.layer?.key === 'sky-ending-departure',
        );
    const start = scenery(0),
        leaving = scenery(SKY_DEPARTURE * 0.57);
    assert.ok(start.length > 0 && leaving.length > 0);
    assert.ok(leaving[0].layer.opacity < start[0].layer.opacity);
    const bounds = (commands) => {
        const points = commands.flatMap((command) => command.points);
        return {
            right: Math.max(...points.map(([x]) => x)),
            bottom: Math.max(...points.map(([, y]) => y)),
        };
    };
    assert.ok(
        bounds(leaving).right < bounds(start).right,
        'the ledge retreats behind the chair',
    );
    assert.deepEqual(
        scenery(SKY_DEPARTURE),
        [],
        'open sky remains before the camera turns',
    );
    assert.ok(
        SKY_DEPARTURE < STAGE_FOUR.reveal.settle,
        'the ledge is gone before the turn starts',
    );
    assert.deepEqual(
        scenery(0),
        start,
        'backward seeking restores the departure scenery',
    );
});

test('arrival spray shortens and settles into the existing chair animation', () => {
    const chair = (time, spray, arrival) => {
        const view = createSkyProjection(1000, 510, 0);
        endingChair(view, time, spray, arrival);
        return view.commands();
    };
    const plume = (commands) =>
        commands.filter(
            (command) =>
                typeof command.fill === 'string' &&
                command.fill.startsWith('#f6e6df'),
        );
    const bottom = (commands) =>
        Math.max(
            ...plume(commands)
                .flatMap((command) => [...command.points, ...command.curves])
                .map((point) => point[1]),
        );
    assert.ok(bottom(chair(0, 2.5, 0)) > bottom(chair(0, 1, 0)) + 30);
    assert.notDeepEqual(
        chair(0.1, 1, 1),
        chair(0.1, 1, 0),
        'arrival initially shakes the chair',
    );
    const settled = SKY_DEPARTURE + 0.1;
    near(
        revealFrame('reveal', settled).slice(-chair(settled, 1, 0).length),
        chair(settled, 1, 0),
        'arrival motion returns to the original animated model before the camera turns',
    );
    near(plume(revealFrame('reveal', settled)), plume(chair(settled, 1, 0)));
});
const hex = (color) =>
    [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
const cloudBodies = (commands, tone) =>
    commands.filter(
        (command) =>
            Array.isArray(command.fill?.stops) &&
            command.fill.stops[0][1].slice(0, 3).join() ===
                hex(tone.top).join(),
    );

test('the ending clouds are bread clouds, not flat pale ovals', () => {
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    for (const [phase, age] of /** @type {const} */ ([
        ['reveal', 0],
        ['reveal', settle + turn / 2],
        ['depth', 0],
        ['depth', hold],
    ])) {
        const commands = revealFrame(phase, age);
        assert.ok(
            cloudBodies(commands, CLOUD_TONES.bread).length >= 5,
            `${phase} ${age}: bread clouds stay on screen`,
        );
        assert.ok(
            !commands.some(
                (command) =>
                    command.fill === '#f6e6dfbe' ||
                    command.fill === '#f6e6dfc3',
            ),
        );
    }
});

test('ending clouds are bread from the start and none vanishes while the camera turns', () => {
    const { settle, turn, hold } = STAGE_FOUR.reveal;
    const bodies = (commands) =>
        commands.filter(
            (command) =>
                !command.layer?.key?.startsWith('orbit-satellite-light') &&
                Array.isArray(command.fill?.stops) &&
                !command.fill.radius &&
                command.fill.stops.length === 3 &&
                command.fill.stops[2][1][3] === 0,
        );
    const bread = hex(CLOUD_TONES.bread.top).join();
    let previous = 0;
    for (let at = 0; at <= settle + turn + hold; at += 1 / 30) {
        const turning = at < settle + turn;
        const clouds = bodies(
            revealFrame(
                turning ? 'reveal' : 'depth',
                turning ? at : at - settle - turn,
            ),
        );
        assert.deepEqual(
            clouds
                .map((command) => command.fill.stops[0][1].slice(0, 3).join())
                .filter((crown) => crown !== bread),
            [],
            `every cloud is bread at ${at.toFixed(2)} s`,
        );
        assert.ok(
            clouds.length >= previous,
            `no cloud disappears at ${at.toFixed(2)} s`,
        );
        previous = clouds.length;
    }
});

test('the last ending frame shows the same bread clouds as the first frame of stage five', () => {
    const ending = cloudBodies(
        revealFrame('depth', STAGE_FOUR.reveal.hold),
        CLOUD_TONES.bread,
    );
    const stageFive = cloudBodies(renderFrame(5), CLOUD_TONES.bread);
    assert.ok(stageFive.length >= 5);
    assert.deepEqual(
        ending.map(({ v, curves }) => ({ v, curves })),
        stageFive.map(({ v, curves }) => ({ v, curves })),
    );
});

test('the last frame of the stage four reveal is the first frame of stage five', () => {
    const last = withoutBubble(revealFrame('depth', STAGE_FOUR.reveal.hold));
    const first = withoutBubble(renderFrame(5));
    assert.equal(last.length, first.length);
    assert.deepEqual(last, first);
});
