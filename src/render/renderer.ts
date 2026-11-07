import { init, type Canvas, type Shape, type ThorVGNamespace } from '@thorvg/webcanvas';
import wasmUrl from '../../node_modules/@thorvg/webcanvas/dist/thorvg.wasm?url';
import { STAGE_TWO } from '../game/stage2';
import { LEVEL } from '../game/level';
import type { GameState } from '../game/game';
import type { DeepReadonly, Person } from '../game/types';
import type { Vector, Curve, Color, Gradient, DrawCommand } from './types';
import { ART } from './art';
import type { EffectsState } from './effects';
export function createRenderer(root: HTMLElement) {
    const base = root.querySelector<HTMLCanvasElement>('[data-base]');
    const cn = root.querySelector<HTMLCanvasElement>('[data-tvg]');
    const labels = root.querySelector<HTMLCanvasElement>('[data-labels]');
    const bg = base?.getContext('2d');
    const lg = labels?.getContext('2d');
    if (!base || !cn || !labels || !bg || !lg) {
        throw new Error('Game canvases are unavailable.');
    }
    // Narrow canvas contexts once for all drawing helpers.
    return setup(root, base, cn, labels, bg, lg);
}
function setup(root: HTMLElement, base: HTMLCanvasElement, cn: HTMLCanvasElement, labels: HTMLCanvasElement, bg: CanvasRenderingContext2D, lg: CanvasRenderingContext2D) {
    const F = LEVEL.floor;
    let LEN: number = LEVEL.length;
    let GOAL: number = LEVEL.goal;
    const TAU = Math.PI * 2;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    let W = 800;
    let H = 510;
    let scale = 1;
    let VW = 800;
    let vertical = 0;
    let dpr = 1;
    let cam = 0;
    let wheel = 0;
    let lastTime = 0;
    let state: GameState;
    let p: GameState['player'];
    let mode: string;
    let monitor: GameState['monitor'] & typeof ART.monitor;
    let cleaning: GameState['cleaning'];
    let bin: GameState['bin'] & {
        bottom: number;
    };
    let copier: GameState['copier'] & {
        flash: number;
    };
    let people: GameState['people'];
    let solids: GameState['solids'];
    let papers: GameState['papers'];
    let inBin: boolean;
    let soaked: boolean;
    let dirty: boolean;
    let t = 0;
    let waterDrops: DeepReadonly<EffectsState['waterDrops']> = [];
    let waterRipples: DeepReadonly<EffectsState['waterRipples']> = [];
    let specks: DeepReadonly<EffectsState['specks']> = [];
    let paperFace = 0;
    let glare = 0;
    let practiceBurst = 0;
    let saveFlash = 0;
    let commands: DrawCommand[] = [];
    let pool: Shape[] = [];
    let TVG: ThorVGNamespace | null = null;
    let tvg: Canvas | null = null;
    let renderer = 'canvas2d';
    let renderError: string | null = null;
    function size() {
        W = Math.max(300, base.clientWidth || 800);
        H = base.clientHeight || 510;
        VW = W < 520 ? 540 : Math.max(760, W);
        scale = W / VW;
        vertical = Math.max(0, H / scale - 510) * .7;
        dpr = Math.min(devicePixelRatio || 1, 2);
        for (const c of [base, labels]) {
            c.width = Math.round(W * dpr);
            c.height = Math.round(H * dpr);
        }
        tvg?.resize(W, H);
    }
    const observer = new ResizeObserver(size);
    observer.observe(base);
    size();
    function monitorPhase() {
        return state.monitor;
    }
    // ThorVG owns the vector paths and gradient fills; labels use a separate text canvas.
    const C = ART.palette;
    let ox = 0;
    let oy = 0;
    let rotation = 0;
    let localScale = 1;
    function polygon(points: Vector[], color: string) {
        commands.push({ v: points.map(([x, y]) => screenPoint(x, y)), c: color });
    }
    // Effects share the same world transform and Canvas2D fallback as the flat artwork.
    function screenPoint(x: number, y: number): Vector {
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);
        x *= localScale;
        y *= localScale;
        return [(x * c - y * s + ox - cam) * scale, (x * s + y * c + oy + vertical) * scale];
    }
    function rgba(hex: string, alpha = 1): Color {
        return [...rgb(hex), Math.round((hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255) * clamp(alpha, 0, 1))];
    }
    function gradientFill(x1: number, y1: number, x2: number, y2: number, stops: [
        number,
        string
    ][], alpha = 1): Gradient {
        return { from: screenPoint(x1, y1), to: screenPoint(x2, y2), stops: stops.map(([at, c]) => [at, rgba(c, alpha)]) };
    }
    function effectPath(start: Vector, curves: Curve[], fill: Gradient) {
        commands.push({ v: [screenPoint(...start)], curves: curves.map(c => [...screenPoint(c[0], c[1]), ...screenPoint(c[2], c[3]), ...screenPoint(c[4], c[5])]), c: fill });
    }
    function gradientPolygon(points: Vector[], fill: Gradient) {
        commands.push({ v: points.map(v => screenPoint(...v)), c: fill });
    }
    function ripple(x: number, y: number, rx: number, ry: number, width: number, color: string) {
        const points: Vector[] = [];
        for (let i = 0; i <= 24; i++) {
            const a = i / 24 * TAU;
            points.push([x + rx * Math.cos(a), y + ry * Math.sin(a)]);
        }
        for (let i = 24; i >= 0; i--) {
            const a = i / 24 * TAU;
            points.push([x + Math.max(0, rx - width) * Math.cos(a), y + Math.max(0, ry - width * .35) * Math.sin(a)]);
        }
        polygon(points, color);
    }
    function tint(hex: string, alpha: number) {
        return hex + Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, '0');
    }
    function rect(x: number, y: number, w: number, h: number, c: string) {
        polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c);
    }
    function ellipse(x: number, y: number, rx: number, ry: number, c: string) {
        polygon(Array.from({ length: 16 }, (_, i) => [x + rx * Math.cos(i / 16 * TAU), y + ry * Math.sin(i / 16 * TAU)]), c);
    }
    function rod(x: number, y: number, xx: number, yy: number, w: number, c: string) {
        let dx = xx - x;
        let dy = yy - y;
        let l = Math.hypot(dx, dy) || 1;
        let nx = -dy / l * w / 2;
        let ny = dx / l * w / 2;
        polygon([[x + nx, y + ny], [xx + nx, yy + ny], [xx - nx, yy - ny], [x - nx, y - ny]], c);
    }
    function label(text: string, x: number, y: number, size = 12, color = '#333d4b', align: CanvasTextAlign = 'center') {
        lg.font = `${size * scale}px system-ui,sans-serif`;
        lg.fillStyle = color;
        lg.textAlign = align;
        lg.fillText(text, (x - cam) * scale, (y + vertical) * scale);
    }
    function plant(x: number) {
        ellipse(x + 2, F - 10, 18, 2.8, '#515c6d40');
        rect(x - 13, F - 40, 26, 30, '#ccc9b5');
        for (let i = 0; i < 5; i++) {
            rod(x, F - 40, x + (i - 2) * 12, F - 70 - Math.abs(i - 2) * 4, 3, '#6c8267');
            polygon([[x + (i - 2) * 12, F - 70 - Math.abs(i - 2) * 4], [x + (i - 2) * 18 - 9, F - 98], [x + (i - 2) * 17 + 11, F - 85]], '#83966a');
        }
    }
    function desk(x: number) {
        ellipse(x + 10, F - 25, 8, 2.1, '#515c6d46');
        ellipse(x + 128, F - 25, 8, 2.1, '#515c6d46');
        rect(x, F - 105, 140, 9, C.wood);
        rod(x + 10, F - 95, x + 10, F - 25, 6, C.steel);
        rod(x + 128, F - 95, x + 128, F - 25, 6, C.steel);
        rect(x + 45, F - 165, 53, 40, '#495569');
        rect(x + 50, F - 160, 43, 30, x === monitor.desk ? (monitorPhase().active ? '#fff4bb' : monitorPhase().warning ? '#e9c98e' : '#9db6c4') : '#9db6c4');
        rod(x + 70, F - 125, x + 70, F - 105, 5, C.steel);
        rect(x + 40, F - 112, 63, 5, '#526274');
    }
    function person(n: DeepReadonly<Person>) {
        ox = n.x;
        oy = F - 17;
        localScale = .85;
        ellipse(-2, 0, 30, 3, '#515c6d62');
        switch (n.id) {
            case 'manager':
                // Wide suit shoulders and folded arms.
                polygon([[-25, -48], [24, -48], [20, -4], [7, -4], [1, -40], [-5, -4], [-19, -4]], '#455064');
                polygon([[-19, -8], [-6, -8], [-4, -1], [-26, -1], [-26, -4]], '#333b4a');
                polygon([[7, -8], [20, -8], [29, -3], [29, -1], [7, -1]], '#333b4a');
                polygon([[-31, -101], [-13, -108], [11, -108], [31, -99], [34, -77], [25, -70], [26, -44], [-26, -44], [-24, -68], [-35, -75]], '#57637a');
                polygon([[-31, -101], [-13, -108], [-7, -108], [-13, -66], [-26, -44], [-24, -68], [-35, -75]], '#626e85');
                polygon([[-13, -107], [12, -107], [1, -78]], '#e0dfd2');
                polygon([[-4, -102], [4, -102], [6, -97], [4, -80], [0, -74], [-4, -80], [-3, -96]], '#956457');
                polygon([[-9, -114], [10, -114], [10, -104], [0, -99], [-9, -104]], '#b4967a');
                polygon([[-17, -147], [-3, -154], [15, -147], [20, -131], [15, -126], [12, -114], [-7, -111], [-18, -123]], '#dfbe99');
                polygon([[-20, -144], [-10, -157], [12, -155], [21, -146], [9, -145], [-5, -149], [-14, -140], [-15, -130], [-20, -134]], '#434957');
                polygon([[-19, -143], [-15, -142], [-16, -130], [-20, -134]], '#7a818d');
                polygon([[10, -137], [17, -137], [17, -135], [10, -135]], '#484655');
                polygon([[-28, -84], [0, -79], [22, -83], [24, -72], [-1, -68], [-27, -72]], '#424e64');
                polygon([[-13, -80], [-5, -79], [-3, -73], [-13, -74]], '#d4b18e');
                polygon([[11, -80], [19, -82], [21, -76], [12, -74]], '#d4b18e');
                break;
            case 'cleaner':
                // Rolled sleeves with the mop tucked into the grip.
                polygon([[-16, -49], [14, -50], [19, -7], [8, -5], [0, -40], [-7, -6], [-19, -7]], '#536373');
                polygon([[-20, -8], [-7, -8], [-7, -1], [-26, -1], [-26, -5]], '#3c4753');
                polygon([[7, -8], [18, -8], [26, -3], [26, -1], [8, -1]], '#3c4753');
                polygon([[-17, -99], [-2, -107], [17, -102], [24, -86], [14, -78], [16, -47], [-17, -45], [-22, -78], [-27, -85]], '#79909f');
                polygon([[-17, -99], [-8, -104], [-7, -48], [-17, -45], [-22, -78], [-27, -85]], '#899eaa');
                polygon([[-10, -105], [1, -97], [11, -104], [15, -97], [6, -91], [0, -97], [-5, -89], [-13, -98]], '#a5b3b9');
                polygon([[-8, -115], [7, -115], [9, -103], [0, -98], [-8, -103]], '#bb9b7c');
                polygon([[-13, -144], [2, -149], [17, -140], [20, -128], [24, -123], [18, -121], [14, -109], [-5, -111], [-13, -121]], '#e5c6a2');
                polygon([[-18, -138], [-14, -151], [-5, -150], [5, -157], [18, -145], [11, -141], [1, -145], [-6, -135], [-11, -139], [-13, -124], [-18, -129]], '#424d5c');
                polygon([[13, -131], [16, -131], [16, -127], [13, -127]], '#4b5059');
                polygon([[18, -86], [22, -88], [79, -4], [74, -2]], '#808c7b');
                polygon([[70, -8], [79, -11], [91, -3], [87, 1], [64, 1]], '#b1ad8e');
                polygon([[17, -81], [26, -66], [38, -70], [42, -64], [26, -55], [19, -57], [9, -73]], '#e0be9c');
                polygon([[10, -78], [20, -85], [24, -78], [14, -70]], '#a9b8c0');
                break;
            case 'admin':
                // Long cardigan, tied hair, and a layered clipboard.
                polygon([[-19, -53], [16, -53], [17, -6], [6, -6], [0, -42], [-7, -6], [-18, -6]], '#495368');
                polygon([[-18, -8], [-7, -8], [-7, -1], [-26, -1], [-26, -5]], '#363d4d');
                polygon([[6, -8], [17, -8], [24, -3], [24, -1], [6, -1]], '#363d4d');
                polygon([[-20, -104], [-8, -108], [10, -108], [24, -102], [28, -77], [20, -74], [21, -39], [-21, -39], [-17, -76], [-25, -79]], '#66566e');
                polygon([[-20, -104], [-8, -108], [-5, -41], [-21, -39], [-17, -76], [-25, -79]], '#78647d');
                polygon([[-8, -108], [10, -108], [1, -82]], '#ddd4c5');
                polygon([[-8, -117], [8, -117], [8, -104], [1, -99], [-8, -104]], '#aa8e73');
                polygon([[-18, -140], [-6, -152], [14, -146], [20, -133], [18, -117], [4, -110], [-14, -117]], '#dfbd9d');
                polygon([[-22, -140], [-14, -154], [0, -158], [15, -152], [20, -141], [3, -146], [-10, -133], [-10, -120], [-18, -117]], '#4b3f49');
                ellipse(-18, -124, 10, 10, '#4b3f49');
                polygon([[10, -133], [15, -133], [15, -131], [10, -131]], '#514552');
                polygon([[-2, -79], [13, -81], [10, -68], [0, -68]], '#ac9e92');
                polygon([[-1, -76], [33, -75], [29, -51], [-5, -53]], '#b8a682');
                polygon([[4, -72], [28, -71], [25, -55], [1, -56]], '#d8cbb4');
                polygon([[10, -74], [23, -74], [23, -70], [10, -70]], '#8b8e95');
                polygon([[-7, -65], [4, -61], [3, -55], [-10, -59]], '#d7b697');
                break;
        }
        ox = oy = 0;
        localScale = 1;
    }
    function binBack() {
        rect(bin.a - 8, F - 16, 176, 10, '#5b6e70');
        polygon([[bin.a + 5, F - 7], [bin.b - 5, F - 7], [bin.b - 16, bin.bottom], [bin.a + 16, bin.bottom]], '#687b7d');
        ellipse(bin.x, F - 8, 79, 12, '#303d44');
    }
    function binFront() {
        polygon([[bin.a + 5, F + 3], [bin.b - 5, F + 3], [bin.b - 16, bin.bottom], [bin.a + 16, bin.bottom]], '#8d9c96');
        for (let x = bin.a + 23; x < bin.b - 10; x += 18) {
            rod(x, F + 15, x + 4, bin.bottom - 12, 2, '#6e807c');
        }
        ellipse(bin.x, F + 3, 78, 7, '#a4b1a5');
        rect(bin.x - 27, F + 35, 54, 29, '#d7dcc7');
    }
    function cleaningDraw() {
        const spread = cleaning.spilled ? Math.min(1, cleaning.age / .8) : 0;
        if (spread > 0) {
            const width = (cleaning.b - cleaning.a) * spread;
            const inlet = Math.min(cleaning.x - 46 - cleaning.a, width * .5);
            const depth = 6 + 15 * spread;
            ox = cleaning.a;
            oy = F;
            effectPath([inlet, -17], [
                [inlet * .35, -8, 0, -4, 0, 3],
                [0, depth, width * .28, depth + 2, width * .42, depth],
                [width * .66, depth + 1, width * .94, depth - 6, width, depth - 4],
                [width, depth - 13, width * .57, depth - 10, width * .41, depth - 14],
                [width * .2, depth - 16, inlet * 1.3, -8, inlet, -17]
            ], gradientFill(0, -17, 0, depth + 2, [[0, '#777b5f'], [.55, '#8f9679'], [1, '#78826e']]));
            ellipse(width * .28, depth - 6, width * .1, spread * 1.8, '#c6cbae90');
            ellipse(width * .48, depth - 9, width * .06, spread * 1.4, '#c6cbae70');
            ox = oy = 0;
            if (state.slip) {
                rod(p.x - 95, F - 2, p.x - 30, F - 2, 3, '#5e716c');
                rod(p.x - 82, F + 4, p.x - 18, F + 4, 2, '#61736e');
            }
        }
        // The wheeled bucket tips as the chair approaches.
        const tip = cleaning.spilled ? Math.min(1, cleaning.age / .42) : 0;
        ellipse(cleaning.x - tip * 20, F + 1, 28 + tip * 5, 3, '#515c6d48');
        ox = cleaning.x;
        oy = F - 3;
        rotation = -tip * 1.25;
        polygon([[-23, -50], [20, -50], [15, -7], [-18, -7]], '#c0a775');
        ellipse(-2, -50, 22, 6, '#647260');
        rod(-24, -46, -19, -66, 3, '#7d8790');
        rod(-19, -66, 18, -66, 3, '#7d8790');
        rod(18, -66, 23, -46, 3, '#7d8790');
        rect(-21, -7, 41, 7, '#8d8b74');
        ellipse(-15, 2, 5, 5, '#555f66');
        ellipse(15, 2, 5, 5, '#555f66');
        rect(-11, -36, 19, 13, '#eee1b5');
        ox = oy = rotation = 0;
        if (cleaning.spilled && cleaning.age < 1.1) {
            const u = clamp(cleaning.age / 1.1, 0, 1);
            const reach = Math.sin(Math.min(1, u * 2) * Math.PI / 2);
            const fade = Math.sin(u * Math.PI);
            const side = cleaning.splashDir;
            ox = cleaning.x - 10;
            oy = F - 24;
            // Two overlapping curved sheets retain the muddy, hand-cut palette.
            for (let i = 0; i < 2; i++) {
                const end = -65 - (125 - i * 38) * reach;
                const crest = -30 - (80 - i * 22) * Math.sin(u * Math.PI);
                effectPath([0, 0], [[end * .3, crest - 25, end * .65, crest, end, 12], [end + 24, 8, end + 38, -6, end + 52, 6], [end * .4, 14, -18, 24, 0, 0]].map(c => c.map((v, i) => i % 2 === 0 ? v * -side : v) as Curve), gradientFill(0, -65, 0, 30, [[0, '#bfca9c90'], [.45, '#8e9c7dcc'], [1, '#66796318']], fade));
            }
            ox = oy = rotation = 0;
        }
        for (const r of waterRipples) {
            const u = r.age / r.life;
            ripple(r.x, F + 5, 4 + u * (14 + r.r * 2), 1.5 + u * 3, 1.2, tint('#c0c7a4', (1 - u) * .65));
        }
        for (const z of waterDrops) {
            const fade = clamp(z.life / .35, 0, 1);
            const speed = Math.hypot(z.vx, z.vy);
            const stretch = z.landed ? 1 : clamp(speed / 130, 1, 2.8);
            ox = z.x;
            oy = z.y;
            rotation = Math.atan2(z.vy, z.vx) - Math.PI / 2;
            const r = z.r;
            const w = r * .68;
            const h = r * stretch;
            effectPath([0, -h], [[w, -h * .25, w, h * .65, 0, h], [-w, h * .65, -w, -h * .25, 0, -h]], gradientFill(-w, 0, w, 0, [[0, '#647960d0'], [.48, '#a8b58bdc'], [1, '#7d8e7880']], fade));
            if (!z.landed && z.r > 4) {
                ellipse(-w * .25, -h * .1, .8, h * .32, tint('#e0dfb7', fade * .7));
            }
            ox = oy = rotation = 0;
        }
    }
    function monitorDraw() {
        const m = monitorPhase();
        const x = monitor.x;
        const y = monitor.y;
        // The light starts inside the screen of the ordinary monitor on the last desk.
        if (m.active) {
            const age = m.phase - .8;
            const u = age / 1.3;
            const envelope = Math.min(1, age / .12, (1.3 - age) / .22);
            const pulse = .82 + .18 * Math.sin(age * TAU * 2);
            const end = monitor.wall;
            const beam = gradientFill(x, y, end - 35, F, [[0, '#fffbe7cc'], [.22, '#fff3c47c'], [.7, '#f5d79950'], [1, '#f5d79900']], envelope * pulse);
            gradientPolygon([[x - 18, y - 10], [x + 12, y + 10], [end + 38, F + 14], [end - 144, F - 135]], beam);
            gradientPolygon([[x - 7, y - 3], [x + 5, y + 5], [end + 8, F + 8], [end - 70, F - 74]], gradientFill(x, y, end, F, [[0, '#fffdf0ed'], [.4, '#fff6cc98'], [1, '#ffe8a91a']], envelope));
            // Advect narrow ribbons down the reflection instead of blinking the entire beam.
            for (let i = 0; i < 4; i++) {
                const f = (age * 1.15 + i / 4) % 1;
                const xx = x + (end - x) * f;
                const yy = y + (F - y) * f;
                const w = 3 + f * 24;
                const a = Math.sin(f * Math.PI) * envelope;
                gradientPolygon([[xx - w, yy - 8], [xx + w * .6, yy + 5], [xx + w * .6 - 4, yy + 9], [xx - w - 4, yy - 4]], gradientFill(xx - w, yy, xx + w, yy, [[0, '#fff8dc00'], [.5, '#fffbe8c0'], [1, '#fff8dc00']], a));
            }
            const glow = 14 + 3 * Math.sin(u * TAU);
            gradientPolygon([[x - 30, y - 26], [x + 26, y - 26], [x + 26, y + 26], [x - 30, y + 26]], gradientFill(x - 28, y, x + 28, y, [[0, '#fff6cf00'], [.5, '#fffbe4a0'], [1, '#fff6cf00']], envelope));
            rod(x - glow, y - 3, x + glow, y - 3, 2, tint('#fffce7', envelope * .85));
            gradientPolygon([[end - 80, F - 1], [end + 48, F - 1], [end + 48, F + 17], [end - 80, F + 17]], gradientFill(end - 80, F, end + 48, F, [[0, '#efd39c00'], [.5, '#fff1c7b0'], [1, '#efd39c00']], envelope * pulse));
        }
        else if (m.warning) {
            const charge = m.phase / .8;
            for (let i = 0; i < 5; i++) {
                rect(monitor.wall - 48 + i * 20, F - 2, 9, 3 + charge * 9, tint('#f1d8a5', .3 + charge * .6));
            }
            rect(x - 19, y - 12, 32 * charge, 5, '#ead5a4');
            const blink = .45 + .55 * Math.sin(charge * Math.PI * 3) ** 2;
            ellipse(x - 3, y - 2, 4 + charge * 5, 3 + charge * 3, tint('#fff4c6', blink * .65));
            rod(x - 5, y - 21, x - 5, y - 29 - charge * 5, 2, '#dca468');
            rod(x - 22, y - 16, x - 28 - charge * 4, y - 23, 2, '#dca468');
        }

    }
    function player() {
        ox = p.x + ART.player.offsetX;
        oy = p.y + ART.player.offsetY;
        rotation = p.a + (mode === 'play' && t < 1 && !state.lessons.moved ? Math.sin(t * 12) * .025 : 0);
        localScale = ART.player.scale;
        rod(0, -4, 0, 16, 6, C.steel);
        rod(-29, 21, 0, 13, 5, C.steel);
        rod(0, 13, 29, 21, 5, C.steel);
        for (const x of [-27, 27]) {
            ellipse(x, 23, 7, 8, '#3f4650');
            rod(x - 3 * Math.cos(wheel), 23 - 3 * Math.sin(wheel), x + 3 * Math.cos(wheel), 23 + 3 * Math.sin(wheel), 1, '#9197a2');
        }
        rod(-24, -10, -31, -61, 7, '#515665');
        polygon([[-40, -69], [-24, -68], [-23, -20], [-37, -20]], '#666d80');
        rect(-30, -15, 62, 12, '#6f7687');
        rod(-15, -22, -15, -8, 3, C.steel);
        rod(20, -22, 20, -8, 3, C.steel);
        polygon([[-10, -25], [22, -25], [32, -22], [43, 4], [35, 6], [23, -13], [-9, -15]], '#4e5b70');
        polygon([[35, 3], [42, 3], [50, 6], [55, 9], [52, 10], [35, 7]], '#383f4e');
        polygon([[-14, -26], [22, -25], [29, -21], [34, 11], [26, 13], [21, -12], [-13, -16]], '#5b6b80');
        polygon([[-11, -25], [20, -24], [26, -21], [7, -20], [-10, -21]], '#6d7b8e');
        polygon([[25, -18], [27, -17], [31, 10], [29, 10]], '#49586c');
        polygon([[26, 11], [33, 10], [35, 15], [26, 16]], '#383f4e');

        polygon([[-17, -63], [-6, -64], [5, -60], [9, -25], [-17, -23]], C.shirt);
        polygon([[-17, -62], [-11, -61], [-11, -24], [-17, -23]], '#d9d6c5');
        polygon([[-7, -70], [4, -68], [5, -60], [1, -56], [-7, -62]], '#d5b18b');
        polygon([[-9, -65], [0, -60], [6, -60], [4, -55], [0, -52], [-6, -57]], '#fff6de');
        polygon([[1, -58], [5, -57], [5, -54], [8, -36], [6, -33], [1, -34], [2, -54]], '#a65e44');

        polygon([[-13, -87], [-4, -95], [10, -91], [13, -84], [14, -79], [17, -75], [13, -74], [11, -66], [2, -66], [-9, -69], [-12, -77]], C.skin);
        polygon([[-11, -76], [-7, -72], [1, -69], [11, -69], [11, -66], [2, -66], [-9, -69]], '#d3b18c');
        polygon([[-15, -87], [-5, -100], [10, -97], [16, -88], [3, -87], [-3, -83], [-10, -77]], '#3c424f');
        polygon([[-7, -93], [-4, -98], [3, -96]], '#687380');
        const glance = state.lossReason === 'focus' ? .5 + .5 * Math.sin(state.focusLossTime * 6) : state.focusNotice ? Math.sin((1.7 - state.focusNotice.life) / 1.7 * Math.PI) : 0;
        const gx = -glance * 10;
        ellipse(-7, -81, 2.7, 3.4, C.skin);
        rod(-5, -83, 4, -84, 1.35, '#3a414b');
        rect(3 + gx, -86, 11, 6, '#50606a');
        rect(4 + gx, -85, 9, 4, '#83c8e4');
        rect(5 + gx, -85, 2, 4, '#bfe6ef');
        rect(12 + gx, -84, 1.2, 2, '#446d82');
        rod(9, -71, 12, -71, 1, '#9c775f');

        polygon([[-17, -58], [-13, -60], [-9, -57], [-8, -35], [-18, -34]], '#e6e0cc');
        polygon([[-19, -39], [-8, -39], [-8, -34], [-19, -33]], '#fff6de');
        polygon([[-16, -34], [-9, -35], [23, -36], [25, -32], [-15, -27]], C.skin);
        polygon([[-15, -29], [23, -33], [24, -32], [-15, -27]], '#d3aa80');
        polygon([[21, -31], [54, -31], [65, -59], [33, -59]], '#555f70');

        polygon([[35, -55], [59, -55], [51, -35], [27, -35]], '#a8b9c3');

        rod(18, -29, 55, -29, 3, C.steel);
        const tap = state.lossReason === 'focus' ? 0 : Math.sin(t * 24) * 1.8;
        polygon([[17, -36], [23, -38], [30, -36], [34, -33], [31, -32], [26, -34], [18, -33]], '#d3aa80');
        polygon([[21, -36 + tap], [25, -39 + tap], [30, -38 + tap], [35, -35 + tap], [36, -33 + tap], [33, -33 + tap], [29, -35 + tap], [23, -33 + tap]], C.skin);
        if (state.focusNotice?.kind === 'water') rod(7, -39, 44, -57, 5, C.skin);
        if (saveFlash > 0) {
            rect(40, -52, 11, 11, '#e0ecd2');
            rect(42, -52, 6, 4, '#728a7b');
            rect(43, -45, 5, 3, '#728a7b');
        }
        if (paperFace > 0) {
            polygon([[-13, -89], [13, -85], [10, -65], [-15, -69]], C.paper);
            rod(-8, -82, 9, -80, 1, '#a8a79e');
            rod(-8, -77, 7, -75, 1, '#a8a79e');
        }
        if (soaked) {
            for (const [x, y] of [[-13, -49], [5, -29], [34, -44]]) {
                ellipse(x, y, 4, 6, '#8b9c777d');
            }
        }
        if (dirty) {
            for (let i = 0; i < 9; i++) {
                const x = -25 + (i * 17) % 60;
                const y = -82 + (i * 23) % 79;
                polygon([[x, y], [x + 9, y - 4], [x + 12, y + 6], [x + 2, y + 8]], ['#d6c998', '#85946b', '#a88e69'][i % 3]);
            }
            polygon([[-14, -94], [-2, -104], [7, -94]], '#c4ae73');
            rod(-3, -98, 0, -88, 2, '#849267');
        }
        if (mode === 'impact' || (mode === 'dead' && state.lossReason === 'head')) {
            for (let i = 0; i < 8; i++) {
                const angle = i * TAU / 8;
                rod(Math.cos(angle) * 19, -77 + Math.sin(angle) * 19, Math.cos(angle) * 28, -77 + Math.sin(angle) * 28, 3, '#e5b17f');
            }
        }
        ox = oy = rotation = 0;
        localScale = 1;
    }
    function practiceFloor() {
        if (cam > 340) return;
        rect(45, F - 3, 260, 6, '#d2c8a3');
        for (let x = 55; x < 300; x += 26) rect(x, F + 12, 13, 3, '#e4dabb');
        polygon([[290, F + 7], [303, F + 14], [290, F + 21]], '#e4dabb');
        const pile = LEVEL.practicePaper;
        if (!state.lessons.jumped) {
            for (let i = 0; i < 3; i++) rect(pile.x - pile.width / 2 + i * 3, F - 2 - i * 2, pile.width - i * 4, 2, C.paper);
        }
        if (practiceBurst > 0) {
            const age = 1.3 - practiceBurst;
            for (let i = 0; i < 7; i++) {
                ox = pile.x + (i - 3) * age * 37;
                oy = F - 9 - Math.sin(age / 1.3 * Math.PI) * (45 + i % 3 * 15);
                rotation = age * (i % 2 ? 2 : -2);
                rect(-10, -5, 20, 10, C.paper);
                rod(-6, -1, 5, -1, 1, '#a2aaa8');
            }
            ox = oy = rotation = 0;
        }
    }
    function checkpointFlag(x: number, y: number, active: boolean) {
        const raising = active && Math.abs(p.x - x) < 170 ? clamp((1.5 - saveFlash) / .45, 0, 1) : 1;
        const height = active ? 25 + 55 * raising : 25;
        rod(x, y, x, y - 93, 3, '#677d7e');
        polygon([[x, y - height], [x + 32, y - height + 10], [x, y - height + 22]], active ? '#b8d6a2' : '#b4bab3');
        if (active) {
            rod(x + 7, y - height + 10, x + 12, y - height + 15, 2, '#526d66');
            rod(x + 12, y - height + 15, x + 21, y - height + 6, 2, '#526d66');
        }
        if (state.lossReason && active) {
            ellipse(x, y + 4, 27, 5, '#d7cf9b');
        }
    }
    function building() {
        commands = [];
        ox = oy = rotation = 0;
        rect(cam, -vertical, VW, H / scale, '#a9afbc');
        rect(cam, -vertical, VW, 57 + vertical, '#747d91');
        rod(cam, 57, cam + VW, 57, 4, '#d1d1c6');
        for (let x = Math.floor(cam / 235) * 235; x < cam + VW + 235; x += 235) {
            rect(x + 17, 80, 197, 193, '#69788c');
            rect(x + 24, 87, 183, 179, '#9aa9b2');
            rod(x + 113, 87, x + 113, 267, 4, '#69788c');
            rect(x + 43, 27, 145, 7, '#f1e9cf');
        }
        rect(cam, 287, VW, 250, '#a0a7b1');
        rod(cam, 315, cam + VW, 315, 2, '#8c94a1');
        for (const [x, title] of [[190, '회의실 / MEETING'], [1180, '비상계단 / STAIRS'], [2050, '비품 창고 / STORAGE'], [2820, '승강로 / LIFT']] as const) {
            rect(x - 85, 110, 210, 32, '#687e7c');
            label(title, x + 20, 131, 13, '#f0eddc');
        }
        rect(120, 300, 400, 12, '#b8a283');
        for (const x of [150, 465]) rod(x, 312, x, 420, 7, '#697585');
        for (let x = 150; x < 500; x += 110) {
            rect(x, 278, 50, 22, '#596577'); rect(x + 5, 282, 40, 13, '#a8b9c3');
        }
        for (const ob of solids) polygon(ob.p.map(v => [v.x, v.y]), C.floor);
        for (const item of state.furniture) {
            const x = item.x, y = item.y;
            if (item.kind === 'cabinet') {
                rect(x - 50, y - 55, 100, 48, '#c6c9bf');
                for (let i = 0; i < 2; i++) { rect(x - 45, y - 50 + i * 23, 90, 20, '#afb8b2'); rect(x - 9, y - 45 + i * 23, 18, 3, '#6c7d83'); }
            } else {
                rod(x - 18, y - 37, x - 22, y - 90, 6, '#515665');
                rect(x - 30, y - 90, 18, 48, '#6f7687'); rect(x - 24, y - 40, 48, 8, '#6f7687');
                rod(x, y - 32, x, y - 10, 5, C.steel); rod(x - 22, y - 8, x + 22, y - 8, 4, C.steel);
            }
            ellipse(x - item.width / 2 + 8, y - 5, 5, 5, '#3f4650'); ellipse(x + item.width / 2 - 8, y - 5, 5, 5, '#3f4650');
        }
        const door = state.door;
        rect(door.x - 58, 210, 116, 210, '#7d91937f');
        rod(door.x - 59, 210, door.x - 59, 420, 6, '#596879'); rod(door.x + 59, 210, door.x + 59, 420, 6, '#596879');
        rod(door.x, 220, door.x, 418, 5, '#596879');
        const reach = Math.cos(door.angle) * 52;
        polygon([[door.x, 230], [door.x + reach, 242], [door.x + reach, 405], [door.x, 418]], '#c5dcd4b0');
        polygon([[door.x, 230], [door.x - reach, 242], [door.x - reach, 405], [door.x, 418]], '#8faeb0b0');
        ellipse(door.x, 192, 7, 7, door.open ? '#b8d6a2' : '#e0b477');
        label(door.open ? '→' : '↻', door.x, 177, 24, '#f0eddc');
        for (const x of [door.x - 100, door.x - 76]) {
            ellipse(x, F + 4, 8, 3, '#d1c8a5');
            rod(x - 8, F + 12, x + 8, F + 12, 2, '#778783');
        }
        if (door.open) {
            polygon([[door.x - 14, F + 12], [door.x + 6, F + 12], [door.x + 6, F + 6], [door.x + 19, F + 16], [door.x + 6, F + 26], [door.x + 6, F + 20], [door.x - 14, F + 20]], '#d8dfbf');
        } else {
            rod(door.x - 28, F + 12, door.x + 28, F + 12, 5, '#d5be92');
            rod(door.x - 28, F + 20, door.x + 28, F + 20, 3, '#d5be92');
        }
        for (const [a, b, ya, yb] of [[1020, 1400, 420, 500], [1580, 1900, 500, 420]]) {
            rod(a, ya - 95, b, yb - 95, 5, '#697585');
            for (let x = a; x <= b; x += 70) { const y = ya + (yb - ya) * (x - a) / (b - a); rod(x, y - 95, x, y, 3, '#7d8995'); }
        }
        rect(2350, 185, 350, 18, '#687783');
        for (let x = 2360; x < 2690; x += 24) rod(x, 189, x + 12, 198, 3, '#9eafb1');
        label('→', 2460, 275, 25, '#e6d6a8');
        for (const x of [2700, 3150]) rod(x, 160, x, 500, 7, '#687783');
        rod(2700, 322, 3160, 322, 2, '#d7ccb0');
        for (let x = 2700; x < 3160; x += 48) ellipse(x, 322, 3, 3, '#f0dfb5');
        const lift = state.elevator;
        rect(lift.x, lift.y, lift.width, lift.height, '#7e9a91');
        for (let x = lift.x + 10; x < lift.x + lift.width; x += 24) rect(x, lift.y + 2, 12, 4, '#e6d6a8');
        label('↔', lift.x + lift.width / 2, lift.y - 20, 24, '#e9e3ce');
        for (let x = 2890; x < 3380; x += 95) {
            const y = 500 - (x - 2850) * 190 / 550;
            rod(x, y - 5, x + 28, y - 15, 4, '#e0d1a4');
        }
        for (let i = 1; i < STAGE_TWO.checkpoints.length; i++) {
            const mark = STAGE_TWO.checkpoints[i];
            checkpointFlag(mark.x, mark.y + 28, state.checkpoint >= i);
        }
        rect(GOAL - 35, 105, 106, 205, '#677d7e'); rect(GOAL - 27, 113, 90, 190, '#b5c4bf');
        rect(GOAL - 31, 74, 98, 23, '#718e7b'); label('기계실 →', GOAL + 18, 91, 13, '#f0eddc');
        rod(GOAL + 40, 190, GOAL + 40, 229, 4, '#677d7e');
        practiceFloor();
        ellipse(p.x, p.y + 35, 45, 5, '#91959c'); player();

    }
    function world() {
        commands = [];
        ox = oy = rotation = 0;
        const left = cam - 100;
        const right = cam + VW + 100;
        rect(cam, -vertical, VW, H / scale, '#a9afbc');
        rect(cam, -vertical, VW, 57 + vertical, '#747d91');
        rod(cam, 57, cam + VW, 57, 4, '#d1d1c6');
        for (let i = Math.floor(cam / 235) - 1; i < (cam + VW) / 235 + 1; i++) {
            const x = i * 235;
            rect(x + 17, 80, 197, 193, '#69788c');
            rect(x + 24, 87, 183, 179, '#202940');
            for (let j = 0; j < 4; j++) {
                const bx = x + 30 + j * 42;
                const h = 60 + (i * 23 + j * 31 + 300) % 80;
                rect(bx, 260 - h, 32, h, '#425069');
                for (let k = 0; k < 3; k++) {
                    // Pick one window per pane and stagger its short off interval across panes.
                    const flickers = j === ((i % 4) + 4) % 4 && k === 1;
                    const period = 3.4 + ((i % 3 + 3) % 3) * .7;
                    const phase = (t + (i * 1.37 % period) + period) % period;
                    const color = flickers && phase < .38 ? '#334056' : '#e2cea1';
                    rect(bx + 6, 269 - h + k * 20, 6, 8, color);
                }
            }
            rod(x + 113, 87, x + 113, 267, 4, '#69788c');
            rod(x + 24, 179, x + 207, 179, 3, '#69788c');
            rect(x + 43, 27, 145, 7, '#f1e9cf');
        }
        const rearFloor = F - 62;
        rect(cam, 287, VW, rearFloor - 287, '#a0a7b1');
        rect(cam, rearFloor - 5, VW, 6, '#848e9d');
        rect(cam, rearFloor + 1, VW, F - rearFloor - 1, '#aeb3bb');
        for (const ob of solids) {
            polygon(ob.p.map(v => [v.x, v.y]), C.floor);
            const [topLeft, topRight] = ob.p;
            rod(topLeft.x, topLeft.y, topRight.x, topRight.y, 1.2, '#a5abb5');
        }
        rod(cam, rearFloor + 28, cam + VW, rearFloor + 28, .9, '#9da5b1');
        for (let x = Math.floor(left / 110) * 110; x < right; x += 110) {
            rod(x + 15, rearFloor + 1, x, F, 1, '#9ca5b1');
            if (x <= bin.a - 30 || x >= bin.b + 35) {
                rod(x, F, x - 35, F + 150, 1.15, '#a7adb6');
            }
        }
        for (let x = 110; x < GOAL; x += 420) {
            if (x < left - 200 || x > right) {
                continue;
            }
            desk(x);
            plant(x + (x === 110 ? 295 : 205));
        }
        for (const n of people) {
            if (n.x > left && n.x < right) {
                person(n);
            }
        }
        cleaningDraw();
        const x = copier.x;
        ellipse(x + 3, F - 20, 61, 4.2, '#515c6d56');
        rect(x - 56, F - 108, 112, 88, '#c6c9bf');
        rect(x - 48, F - 96, 40, 61, '#aeb7b5');
        rect(x - 1, F - 96, 47, 22, '#717f88');
        const charging = copier.burst > 0;
        rect(x + 6, F - 91, 21, 9, charging ? '#edc883' : '#9fbdad');
        if (charging) {
            for (const dx of [-34, -10, 14, 38]) {
                ellipse(x + dx, F - 103, 7, 4, '#6a7880');
                rod(x + dx, F - 106, x + dx + Math.sin(t * 22) * 4, F - 100, 2, '#e4d8b6');
            }
            polygon([[x - 71, F - 125], [x - 61, F - 139], [x - 51, F - 125]], '#edd0a1');
        }

        rect(x - 56, F - 120, 112, 12, '#dcdccc');
        polygon([[x - 45, F - 121], [x + 35, F - 132], [x + 48, F - 151], [x - 35, F - 143]], '#e7e4d6');
        rect(x - 65, F - 91, 22, 7, '#333d49');
        rect(x + 42, F - 91, 23, 7, '#333d49');
        for (let j = 0; j < 3; j++) {
            rect(x - 37, F - 70 + j * 11, 22, 3, '#737f87');
        }
        for (const z of papers) {
            ox = z.x;
            oy = z.y;
            rotation = z.a;
            rect(-10, -6, 20, 12, C.paper);
            rod(-6, -2, 6, -2, 1, '#9a9e9d');
            rod(-6, 2, 3, 2, 1, '#b3b3a7');
            ox = oy = rotation = 0;
        }
        monitorDraw();
        practiceFloor();
        checkpointFlag(1400, F, state.officeCheckpoint);
        for (let x = 1490; x < 1545; x += 18) {
            polygon([[x, F - 4], [x + 12, F - 4], [x + 24, F - 12], [x + 12, F - 12]], '#e1c38b');
        }

        binBack();
        ellipse(p.x, F + 8, 45, 5, '#91959c');
        player();
        binFront();
        if (ART.debugCollisions) {
            ox = p.x;
            oy = p.y;
            rotation = p.a;
            for (const part of LEVEL.playerContacts) {
                ripple(part.x, part.y, part.r, part.r, 1, '#ff0055');
            }
            ox = oy = rotation = 0;
        }
        for (const z of specks) {
            ox = z.x;
            oy = z.y;
            rotation = z.a;
            rect(-3, -2, 7, 4, z.color);
            ox = oy = rotation = 0;
        }
        rect(GOAL - 35, F - 205, 106, 205, '#677d7e');
        rect(GOAL - 27, F - 197, 90, 190, '#b5c4bf');
        rod(GOAL + 40, F - 120, GOAL + 40, F - 81, 4, '#677d7e');
        rect(GOAL - 31, F - 236, 98, 23, '#718e7b');
        label('출구 →', GOAL + 18, F - 218, 12, '#f0eddc');
        if (glare > 0) {
            rect(cam, -vertical, VW, H / scale, '#fff7d5' + Math.round(Math.min(.22, glare * .16) * 255).toString(16).padStart(2, '0'));
        }
    }
    function rgb(hex: string): [
        number,
        number,
        number
    ] {
        const h = hex.slice(1);
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function paint() {
        if (tvg && TVG) {
            let i = 0;
            for (const cmd of commands) {
                let s = pool[i];
                if (!s) {
                    s = new TVG.Shape();
                    pool.push(s);
                    tvg.add(s);
                }
                s.reset();
                s.moveTo(...cmd.v[0]);
                for (let j = 1; j < cmd.v.length; j++) {
                    s.lineTo(...cmd.v[j]);
                }
                for (const c of cmd.curves || []) {
                    s.cubicTo(...c);
                }
                s.close();
                if (typeof cmd.c === 'string') {
                    s.fill(...rgba(cmd.c));
                }
                else {
                    const g = new TVG.LinearGradient(...cmd.c.from, ...cmd.c.to);
                    g.setStops(...cmd.c.stops);
                    s.fill(g);
                    g.dispose();
                } // Filled gradients belong to their shape; dispose releases the JS handle.
                s.visible(true);
                i++;
            }
            for (; i < pool.length; i++) {
                pool[i].visible(false);
            }
            tvg.update().render();
        }
        else {
            bg.setTransform(dpr, 0, 0, dpr, 0, 0);
            bg.clearRect(0, 0, W, H);
            for (const cmd of commands) {
                bg.beginPath();
                bg.moveTo(...cmd.v[0]);
                for (let i = 1; i < cmd.v.length; i++) {
                    bg.lineTo(...cmd.v[i]);
                }
                for (const c of cmd.curves || []) {
                    bg.bezierCurveTo(...c);
                }
                bg.closePath();
                if (typeof cmd.c === 'string') {
                    bg.fillStyle = cmd.c;
                }
                else {
                    const g = bg.createLinearGradient(...cmd.c.from, ...cmd.c.to);
                    for (const [at, c] of cmd.c.stops) {
                        g.addColorStop(at, `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`);
                    }
                    bg.fillStyle = g;
                }
                bg.fill();
            }
        }
    }
    function draw(next: GameState, effects: EffectsState) {
        state = next;
        LEN = state.level.length;
        GOAL = state.level.goal;
        ({ player: p, mode, cleaning, people, solids, papers, inBin, soaked, dirty, time: t } = state);
        monitor = { ...state.monitor, ...ART.monitor };
        bin = { ...state.bin, bottom: ART.binBottom };
        copier = { ...state.copier, flash: effects.copierFlash };
        ({ waterDrops, waterRipples, specks, paperFace, glare, practiceBurst, saveFlash } = effects);
        const dt = Math.max(0, t - lastTime);
        if (t < lastTime) {
            cam = 0;
            wheel = 0;
        }
        if (mode === 'play') {
            cam += (clamp(p.x - VW * .35, 0, Math.max(0, LEN - VW)) - cam) * Math.min(1, dt * 7);
            wheel += p.vx * dt / 8;
        }
        lastTime = t;
        lg.setTransform(dpr, 0, 0, dpr, 0, 0);
        lg.clearRect(0, 0, W, H);
        if (state.stage === 2) {
            building();
        } else {
            world();
        }
        paint();
        return { cam, scale, vertical, width: W };
    }
    async function initRenderer() {
        try {
            TVG = await init({ renderer: 'sw', locateFile: () => wasmUrl });
            if (!root.isConnected) {
                return;
            }
            tvg = new TVG.Canvas('#chair-office-one-tvg', { width: W, height: H });
            renderer = 'thorvg';
            cn.hidden = false;
        }
        catch (e) {
            renderError = String(e);
            renderer = 'canvas2d';
        }
    }
    void initRenderer();
    return { draw, info: () => ({ renderer, renderError, commands: commands.length }), destroy() {
            observer.disconnect();
            tvg?.destroy();
        } };
}
export type Viewport = {
    cam: number;
    scale: number;
    vertical: number;
    width: number;
};
