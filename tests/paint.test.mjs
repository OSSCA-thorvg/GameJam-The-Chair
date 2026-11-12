import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { paint, createPaintPool, createRenderCtx, createRenderStats, resetRenderStats, createLayerOverrides } = await loadSource(`
    export { paint, createPaintPool } from './src/render/paint';
    export { createRenderStats, resetRenderStats, createLayerOverrides } from './src/render/perf';
    export { createRenderCtx } from './src/render/context';
`);

// A stand-in for ThorVG WebCanvas that keeps only what this bug needs. In ThorVG 1.1.3, removing a scene
// that is on the canvas and got new children since the last update fails with "RuntimeError: null function";
// paint() then left the canvas empty until the layer set changed again, so the picture blinked out.
function fakeThorvg() {
    const log = [];
    const chain = function () { return this; };
    class Paint {
        constructor() { this.onCanvas = false; this.stale = false; }
    }
    class Shape extends Paint {}
    for (const name of ['reset', 'moveTo', 'lineTo', 'cubicTo', 'close', 'fill', 'stroke', 'trimPath', 'blend', 'visible', 'appendRect', 'opacity']) Shape.prototype[name] = chain;
    class Scene extends Paint {
        constructor() { super(); this.children = []; }
        add(child) {
            this.children.push(child);
            if (this.onCanvas && this.rendered) this.stale = true;
            return this;
        }
    }
    for (const name of ['resetEffects', 'gaussianBlur', 'motionBlur', 'blend', 'opacity', 'clip', 'mask', 'visible']) Scene.prototype[name] = chain;
    class Gradient { setStops() { return this; } dispose() {} }
    class Canvas {
        constructor() { this.paints = []; }
        add(paint) { paint.onCanvas = true; this.paints.push(paint); log.push('add'); return this; }
        remove() {
            log.push('remove');
            if (this.paints.some(paint => paint.stale)) throw new Error('RuntimeError: null function');
            for (const paint of this.paints) paint.onCanvas = false;
            this.paints = [];
            return this;
        }
        update() {
            for (const paint of this.paints) {
                paint.stale = false;
                paint.rendered = true;
            }
            return { render() {} };
        }
    }
    const TVG = {
        Shape, Scene, Canvas, LinearGradient: Gradient, RadialGradient: Gradient,
        BlendMethod: { Normal: 0, Multiply: 1, Screen: 2, Add: 3, Overlay: 4 },
        StrokeCap: { Butt: 0, Round: 1 }, StrokeJoin: { Round: 1 }, MaskMethod: { Alpha: 1, InvAlpha: 2 },
    };
    return { TVG, canvas: new Canvas(), log };
}

const square = (x, layer) => ({ v: [[x, 10], [x + 10, 10], [x + 10, 20], [x, 20]], c: '#336699', ...(layer ? { layer } : {}) });

function frame(ctx, layerShapes, plainShapes) {
    const layer = { key: 'water-body' };
    ctx.commands = [
        ...Array.from({ length: layerShapes }, (_, i) => square(20 + i * 12, layer)),
        ...Array.from({ length: plainShapes }, (_, i) => square(200 + i * 12)),
    ];
    ctx.foregroundActors = [];
}

test('a layer that gains children on a reordering frame does not blank the canvas', () => {
    const { TVG, canvas } = fakeThorvg();
    const lg = { save() {}, restore() {} };
    const ctx = createRenderCtx({}, lg);
    Object.assign(ctx, { W: 400, H: 300 });
    const pool = createPaintPool();

    frame(ctx, 2, 3);
    paint(ctx, TVG, canvas, pool);
    // Water spreads (more shapes in the layer) while more plain shapes appear, so the paint order is rebuilt.
    frame(ctx, 12, 5);
    assert.doesNotThrow(() => paint(ctx, TVG, canvas, pool));
    assert.ok(canvas.paints.length > 0, 'the canvas still holds the scene after the rebuild');
});

test('a failed rebuild is retried on the next frame instead of leaving the canvas empty', () => {
    const { TVG, canvas } = fakeThorvg();
    const lg = { save() {}, restore() {} };
    const ctx = createRenderCtx({}, lg);
    Object.assign(ctx, { W: 400, H: 300 });
    const pool = createPaintPool();
    // Plain shapes before the layer, so the signature records how many come first.
    const plainFirst = plain => {
        frame(ctx, 2, 0);
        ctx.commands = [...Array.from({ length: plain }, (_, i) => square(200 + i * 12)), ...ctx.commands];
    };
    plainFirst(4);
    paint(ctx, TVG, canvas, pool);
    paint(ctx, TVG, canvas, pool);

    // One rebuild fails after the canvas was already emptied (as ThorVG does when it throws mid-removal).
    const remove = canvas.remove;
    canvas.remove = function () {
        canvas.remove = remove;
        remove.call(this);
        throw new Error('RuntimeError: null function');
    };
    plainFirst(3);
    assert.throws(() => paint(ctx, TVG, canvas, pool));
    assert.equal(canvas.paints.length, 0);
    // Same picture next frame: it must be put back on the canvas.
    paint(ctx, TVG, canvas, pool);
    assert.ok(canvas.paints.length > 0, 'the next frame rebuilds the emptied canvas');
});

test('profiling counts pooled ThorVG objects, effects and paint-order rebuilds without changing the picture', () => {
    const { TVG, canvas } = fakeThorvg();
    const lg = { save() {}, restore() {} };
    const ctx = createRenderCtx({}, lg);
    Object.assign(ctx, { W: 400, H: 300 });
    const pool = createPaintPool();
    const stats = createRenderStats();
    const blurred = { key: 'glow', blur: 4, motionBlur: { distance: 6, angle: 0 }, clip: square(0), mask: square(0) };
    ctx.commands = [square(20, blurred), square(40, blurred), square(200), square(220), square(1000)];
    ctx.foregroundActors = [];

    paint(ctx, TVG, canvas, pool, stats);
    assert.equal(stats.commands, 5);
    assert.equal(stats.topShapes, 3);
    assert.equal(stats.poolTop, 3);
    assert.equal(stats.layers, 1);
    assert.equal(stats.layerSlots, 1);
    assert.equal(stats.layerShapes, 2);
    assert.equal(stats.parkedShapes, 0);
    assert.equal(stats.reorder, true);
    assert.equal(stats.gaussianBlurs, 1);
    assert.equal(stats.motionBlurs, 1);
    assert.equal(stats.blurAmount, 10);
    assert.equal(stats.masks, 1);
    assert.equal(stats.clips, 1);
    // Two 10×10 squares at x 20 and 40 (each padded by 1 px): x 19–51, y 9–21.
    assert.equal(stats.blurArea, 32 * 12);
    assert.deepEqual(stats.layerList, [{ key: 'glow', shapes: 2, area: 32 * 12, effects: ['blur4', 'motion', 'clip', 'mask'] }]);
    assert.ok(stats.syncMs >= 0 && stats.renderMs >= 0 && stats.labelsMs >= 0);

    // The frame after the pool grew rebuilds once more; a steady layout after that does not.
    resetRenderStats(stats);
    paint(ctx, TVG, canvas, pool, stats);
    resetRenderStats(stats);
    paint(ctx, TVG, canvas, pool, stats);
    assert.equal(stats.reorder, false);
    // One layer child gone: it is parked inside the scene, not removed.
    ctx.commands = [square(20, blurred), square(200), square(220), square(1000)];
    resetRenderStats(stats);
    paint(ctx, TVG, canvas, pool, stats);
    assert.equal(stats.parkedShapes, 1);
});

test('debug layer overrides hide a layer or draw it as plain shapes, and leave other layers alone', () => {
    const { TVG, canvas } = fakeThorvg();
    const lg = { save() {}, restore() {} };
    const ctx = createRenderCtx({}, lg);
    Object.assign(ctx, { W: 400, H: 300 });
    const pool = createPaintPool();
    const stats = createRenderStats();
    const overrides = createLayerOverrides();
    const sun = { key: 'sun', blend: 'screen', opacity: .5 };
    const fog = { key: 'fog', blur: 2 };
    ctx.commands = [square(20, sun), square(40, fog), square(60, fog), square(200)];
    ctx.foregroundActors = [];
    const run = () => {
        resetRenderStats(stats);
        paint(ctx, TVG, canvas, pool, stats, overrides);
        return { keys: stats.layerList.map(layer => layer.key), top: stats.topShapes, commands: stats.commands };
    };

    assert.deepEqual(run(), { keys: ['sun', 'fog'], top: 1, commands: 4 });
    assert.deepEqual(stats.layerList[0].effects, ['α0.50', 'screen']);
    overrides.hidden.add('fog');
    assert.deepEqual(run(), { keys: ['sun'], top: 1, commands: 2 });
    overrides.flat.add('sun');
    assert.deepEqual(run(), { keys: [], top: 2, commands: 2 });
    overrides.hidden.clear();
    overrides.flat.clear();
    assert.deepEqual(run(), { keys: ['sun', 'fog'], top: 1, commands: 4 });
    // The scene's own commands are never changed by an override.
    assert.equal(ctx.commands[0].layer, sun);
});
