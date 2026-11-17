import type {
    Blend,
    DrawCommand,
    PathCommand,
    LayerSpec,
    TextSpec,
} from '../types';

export type Item =
    | { cmd: PathCommand }
    | { text: TextSpec }
    | { layer: LayerSpec; key: string; cmds: PathCommand[] };

// Cull off-canvas children: ThorVG SW includes their empty origin boxes in
// layer buffer bounds.
export function canvasBox(
    cmd: PathCommand,
    width: number,
    height: number,
    extent?: number[],
): [number, number] | null {
    if (cmd.fill === null && !cmd.stroke) {
        return null;
    }
    let xMin = Infinity;
    let yMin = Infinity;
    let xMax = -Infinity;
    let yMax = -Infinity;
    const take = (x: number, y: number) => {
        if (x < xMin) {
            xMin = x;
        }
        if (x > xMax) {
            xMax = x;
        }
        if (y < yMin) {
            yMin = y;
        }
        if (y > yMax) {
            yMax = y;
        }
    };
    for (const [x, y] of cmd.points) {
        take(x, y);
    }
    for (const c of cmd.curves ?? []) {
        take(c[0], c[1]);
        take(c[2], c[3]);
        take(c[4], c[5]);
    }
    const pad = (cmd.stroke?.width ?? 0) / 2 + 1;
    if (
        xMax + pad <= 0 ||
        yMax + pad <= 0 ||
        xMin - pad >= width ||
        yMin - pad >= height
    ) {
        return null;
    }
    if (extent) {
        extent[0] = Math.min(extent[0], Math.max(0, xMin - pad));
        extent[1] = Math.min(extent[1], Math.max(0, yMin - pad));
        extent[2] = Math.max(extent[2], Math.min(width, xMax + pad));
        extent[3] = Math.max(extent[3], Math.min(height, yMax + pad));
    }
    return [
        Math.max(0, Math.min(width - 1, xMin)),
        Math.max(0, Math.min(height - 1, yMin)),
    ];
}

function effective(spec: LayerSpec) {
    return (
        (spec.opacity !== undefined && spec.opacity < 1) ||
        (!!spec.blend && spec.blend !== 'normal') ||
        !!spec.blur ||
        (!!spec.motionBlur && spec.motionBlur.distance > 0.5) ||
        !!spec.clip ||
        !!spec.mask ||
        !!spec.retained
    );
}

const ORDERLESS: ReadonlySet<Blend> = new Set(['screen', 'add', 'multiply']);

function blendOnly(spec: LayerSpec) {
    return (
        !!spec.blend &&
        ORDERLESS.has(spec.blend) &&
        (spec.opacity === undefined || spec.opacity >= 1) &&
        !spec.blur &&
        !(spec.motionBlur && spec.motionBlur.distance > 0.5) &&
        !spec.clip &&
        !spec.mask &&
        !spec.retained &&
        !spec.effectBudget
    );
}

const sharesScene = (a: LayerSpec, b: LayerSpec) =>
    a === b || (a.blend === b.blend && blendOnly(a) && blendOnly(b));

export function collect(commands: DrawCommand[]): Item[] {
    const items: Item[] = [];
    const seen = new Map<string, number>();
    let open: Extract<Item, { layer: LayerSpec }> | null = null;
    for (const cmd of commands) {
        if (cmd.kind === 'text') {
            open = null;
            items.push({ text: cmd.text });
            continue;
        }
        if (
            cmd.layer &&
            cmd.layer.opacity !== undefined &&
            cmd.layer.opacity < 1 / 255
        ) {
            continue;
        }
        if (!cmd.layer || !effective(cmd.layer)) {
            open = null;
            items.push({ cmd: cmd.layer ? { ...cmd, layer: undefined } : cmd });
            continue;
        }
        if (!open || !sharesScene(open.layer, cmd.layer)) {
            const uses: number = seen.get(cmd.layer.key) ?? 0;
            seen.set(cmd.layer.key, uses + 1);
            open = {
                layer: cmd.layer,
                key: uses ? `${cmd.layer.key}#${uses}` : cmd.layer.key,
                cmds: [],
            };
            items.push(open);
        }
        open.cmds.push(cmd);
    }
    return items;
}
