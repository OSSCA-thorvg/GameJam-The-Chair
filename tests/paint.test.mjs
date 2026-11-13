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
    for (const name of ['moveTo', 'lineTo', 'cubicTo', 'close', 'fill', 'stroke', 'trimPath', 'blend', 'visible', 'appendRect', 'opacity']) Shape.prototype[name] = chain;
    Shape.prototype.reset = function () { log.push('shape-reset'); return this; };
    class Scene extends Paint {
        constructor() { super(); this.children = []; }
        add(child) {
            this.children.push(child);
            if (this.onCanvas && this.rendered) this.stale = true;
            return this;
        }
    }
    for (const name of ['resetEffects', 'gaussianBlur', 'motionBlur', 'blend', 'opacity', 'clip', 'mask', 'visible', 'transform']) Scene.prototype[name] = chain;
    Scene.prototype.mask = function (shape, method) { this.maskShape = shape; this.maskMethod = method; return this; };
    Scene.prototype.clip = function (shape) { this.clipShape = shape; return this; };
    class Text extends Paint {
        constructor() { super(); this.calls = {}; }
    }
    for (const name of ['align', 'font', 'text', 'fontSize', 'fill', 'outline', 'opacity', 'transform', 'visible']) {
        Text.prototype[name] = function (...args) { this.calls[name] = args; return this; };
    }
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
        Shape, Scene, Text, Canvas, LinearGradient: Gradient, RadialGradient: Gradient,
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

test('a layer that drops its mask or clip gets a fresh scene instead of a pass-through stand-in', () => {
    // ThorVG cannot detach a mask or clip. The old stand-in (a huge white rect) made the GL renderer smear a
    // Screen-blended water layer over the frame once its mask ended, only when frames were drawn in sequence.
    const { TVG, canvas } = fakeThorvg();
    const lg = { save() {}, restore() {} };
    const ctx = createRenderCtx({}, lg);
    Object.assign(ctx, { W: 400, H: 300 });
    const pool = createPaintPool();
    const sceneOf = () => canvas.paints.find(paint => paint instanceof TVG.Scene);
    const draw = layer => {
        ctx.commands = [square(20, layer), square(200)];
        ctx.foregroundActors = [];
        paint(ctx, TVG, canvas, pool);
        paint(ctx, TVG, canvas, pool);
    };

    draw({ key: 'glint', blend: 'screen', mask: square(0), clip: square(0) });
    const masked = sceneOf();
    assert.ok(masked.maskShape && masked.clipShape);
    assert.equal(masked.maskMethod, TVG.MaskMethod.Alpha);

    draw({ key: 'glint', blend: 'screen', clip: square(0) });
    const unmasked = sceneOf();
    assert.notEqual(unmasked, masked, 'dropping the mask replaces the scene');
    assert.equal(unmasked.maskShape, undefined);
    assert.ok(unmasked.clipShape, 'the clip it still has is set up again');
    assert.ok(!canvas.paints.includes(masked), 'the old scene left the canvas');

    draw({ key: 'glint', blend: 'screen', clip: square(0) });
    assert.equal(sceneOf(), unmasked, 'an unchanged layer keeps its scene');

    draw({ key: 'glint', blend: 'screen', clip: square(0), mask: square(0), maskInvert: true });
    assert.equal(sceneOf(), unmasked, 'adding a mask reuses the scene');
    assert.equal(unmasked.maskMethod, TVG.MaskMethod.InvAlpha);

    draw({ key: 'glint', blend: 'screen', clip: square(0), mask: square(0) });
    const flipped = sceneOf();
    assert.notEqual(flipped, unmasked, 'flipping the mask mode replaces the scene');
    assert.equal(flipped.maskMethod, TVG.MaskMethod.Alpha);

    draw({ key: 'glint', blend: 'screen' });
    assert.equal(sceneOf().clipShape, undefined, 'dropping the clip replaces the scene too');
});

test('retained geometry is traced once while its ThorVG Scene transform can change every frame', () => {
    const { TVG, canvas, log } = fakeThorvg();
    const lg = { save() {}, restore() {} };
    const ctx = createRenderCtx({}, lg);
    Object.assign(ctx, { W: 400, H: 300 });
    const pool = createPaintPool();
    const retained = tx => ({
        key: 'retained:test-wall',
        retained: {
            geometry: 'test-wall',
            transform: { e11: 1, e12: 0, e13: tx, e21: 0, e22: 1, e23: 0, e31: 0, e32: 0, e33: 1 },
            bounds: { left: tx, top: 10, right: tx + 10, bottom: 20 },
        },
    });

    ctx.commands = [square(10, retained(0))];
    ctx.foregroundActors = [];
    paint(ctx, TVG, canvas, pool);
    const firstTraceCount = log.filter(item => item === 'shape-reset').length;

    ctx.commands = [square(10, retained(80))];
    paint(ctx, TVG, canvas, pool);
    assert.equal(log.filter(item => item === 'shape-reset').length, firstTraceCount,
        'moving the retained Scene does not retrace its child path');
});

test('ThorVG Text keeps its place in the command order so later shapes paint over it', () => {
    const { TVG, canvas } = fakeThorvg();
    const ctx = createRenderCtx({}, { save() {}, restore() {} });
    Object.assign(ctx, { W: 400, H: 300 });
    const pool = createPaintPool();
    const text = { content: '흔들리지', font: 'Black Han Sans', size: 40, x: 100, y: 50, rotation: .1, fill: '#fff0cc',
        outline: { width: 3, color: '#27344d' } };
    ctx.commands = [square(10), { v: [[60, 30], [140, 30], [140, 70], [60, 70]], c: '#fff0cc', text }, square(100)];
    ctx.foregroundActors = [];
    paint(ctx, TVG, canvas, pool);

    const kinds = canvas.paints.map(paint => paint.constructor.name);
    assert.deepEqual(kinds, ['Shape', 'Text', 'Text', 'Shape'], 'outline, fill, then the actor drawn after the sign');
    const [back, front] = canvas.paints.slice(1, 3);
    assert.deepEqual(back.calls.outline, [3, 0x27, 0x34, 0x4d], 'the outline sits under the fill');
    assert.equal(front.calls.outline, undefined);
    assert.deepEqual(front.calls.fontSize, [30], 'CSS px are converted to ThorVG points');
    assert.deepEqual(front.calls.align, [.5, .5]);
    assert.equal(front.calls.transform[0].e13, 100);
    assert.ok(Math.abs(front.calls.transform[0].e21 - Math.sin(.1)) < 1e-9);

    ctx.commands = [square(10), square(100)];
    paint(ctx, TVG, canvas, pool);
    assert.equal(front.calls.visible[0], false);
    assert.equal(canvas.paints.filter(paint => paint.constructor.name === 'Shape').length, 2);
});
