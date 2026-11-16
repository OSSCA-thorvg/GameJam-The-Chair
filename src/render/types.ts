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
    // Radial when set: from is the centre; radius is in screen px.
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
export type LayerSpec = {
    key: string;
    // Gaussian sigma in screen px.
    blur?: number;
    // Screen px; degrees clockwise from +x.
    motionBlur?: { distance: number; angle: number };
    blend?: Blend;
    opacity?: number;
    clip?: PathCommand;
    mask?: PathCommand;
    maskInvert?: boolean;
    // Retained geometry belongs to one canvas; only its Scene transform changes.
    retained?: { geometry: string; transform: Transform; bounds: Bounds };
    effectBudget?: { area: number; minScale?: number };
};
export type TextSpec = {
    content: string;
    font: string;
    size: number;
    x: number;
    y: number;
    rotation: number;
    fill: string;
    outline?: { width: number; color: string };
    opacity?: number;
};
export type SceneTalk = {
    reaction: { text: string; life: number } | null;
    speech: { name: string; text: string; x: number; life: number } | null;
};
export type DrawCommand = PathCommand | TextCommand;

export type TextCommand = {
    kind: 'text';
    points: Vector[];
    text: TextSpec;
    layer?: LayerSpec;
};

export type PathCommand = {
    kind: 'path';
    points: Vector[];
    curves?: Curve[];
    fill: string | Gradient | null;
    open?: boolean;
    stroke?: Stroke;
    trim?: [number, number];
    blend?: Blend;
    layer?: LayerSpec;
};
