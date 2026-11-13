export type Vector = [
    number,
    number
];
export type Curve = [
    number,
    number,
    number,
    number,
    number,
    number
];
export type Color = [
    number,
    number,
    number,
    number
];
export type Gradient = {
    from: Vector;
    to: Vector;
    stops: [
        number,
        Color
    ][];
    /** When set, the gradient is radial: `from` is the centre and this is the radius (screen px). */
    radius?: number;
};
export type Blend = 'normal' | 'multiply' | 'screen' | 'add' | 'overlay';
export type Bounds = { left: number; top: number; right: number; bottom: number };
export type Transform = {
    e11: number; e12: number; e13: number;
    e21: number; e22: number; e23: number;
    e31: 0; e32: 0; e33: 1;
};
export type Stroke = {
    width: number;
    color: string | Gradient;
    cap?: 'butt' | 'round';
    dash?: number[];
    dashOffset?: number;
};
/**
 * A run of consecutive draw commands rendered into one ThorVG Scene, so scene
 * effects, blending, opacity and clipping apply to the group as a whole.
 */
export type LayerSpec = {
    key: string;
    /** Gaussian blur sigma in screen px. */
    blur?: number;
    /** Motion blur length in screen px and angle in degrees (clockwise from +x). */
    motionBlur?: { distance: number; angle: number };
    blend?: Blend;
    opacity?: number;
    /** Screen-space path the whole layer is clipped to. */
    clip?: DrawCommand;
    /** Screen-space shape whose fill alpha masks the layer (ThorVG MaskMethod.Alpha). */
    mask?: DrawCommand;
    /** Keep the layer where the mask is transparent instead (ThorVG MaskMethod.InvAlpha). */
    maskInvert?: boolean;
    /**
     * Immutable local geometry owned by this renderer's ThorVG Scene. The path is built once and only the
     * absolute Scene transform changes with the camera. Paints are never shared between canvases.
     */
    retained?: { geometry: string; transform: Transform; bounds: Bounds };
    /** Shrink expensive blur sampling when this layer's expanded screen area exceeds the budget. */
    effectBudget?: { area: number; minScale?: number };
};
export type DrawCommand = {
    v: Vector[];
    curves?: Curve[];
    /** Fill; null draws the outline only (use with `stroke`). */
    c: string | Gradient | null;
    open?: boolean;
    stroke?: Stroke;
    /** Visible fraction of the path [begin, end]. */
    trim?: [number, number];
    blend?: Blend;
    layer?: LayerSpec;
};
