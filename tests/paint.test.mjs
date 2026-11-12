import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { paint, createPaintPool, createRenderCtx } = await loadSource(`
    export { paint, createPaintPool } from './src/render/paint';
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
