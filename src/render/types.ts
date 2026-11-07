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
};
export type DrawCommand = {
    v: Vector[];
    curves?: Curve[];
    c: string | Gradient;
};
