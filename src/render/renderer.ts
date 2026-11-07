import { init, type Canvas, type Shape, type ThorVGNamespace } from '@thorvg/webcanvas';
import wasmUrl from '../../node_modules/@thorvg/webcanvas/dist/thorvg.wasm?url';
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
    const LEN = LEVEL.length;
    const GOAL = LEVEL.goal;
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
    let commands: DrawCommand[] = [];
    let pool: Shape[] = [];
    let TVG: ThorVGNamespace | null = null;
    let tvg: Canvas | null = null;
    let renderer = 'canvas2d';
    let renderError: string | null = null;
    function size() {
        W = Math.max(300, base.clientWidth || 800);
        H = base.clientHeight || 510;
        VW = Math.max(760, W);
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
        rect(x - 13, F - 40, 26, 30, '#ccc9b5');
        for (let i = 0; i < 5; i++) {
            rod(x, F - 40, x + (i - 2) * 12, F - 70 - Math.abs(i - 2) * 4, 3, '#6c8267');
            polygon([[x + (i - 2) * 12, F - 70 - Math.abs(i - 2) * 4], [x + (i - 2) * 18 - 9, F - 98], [x + (i - 2) * 17 + 11, F - 85]], '#83966a');
        }
    }
    function desk(x: number) {
        rect(x, F - 105, 140, 9, C.wood);
        rod(x + 10, F - 95, x + 10, F - 25, 6, C.steel);
        rod(x + 128, F - 95, x + 128, F - 25, 6, C.steel);
        rect(x + 45, F - 165, 53, 40, '#495569');
        rect(x + 50, F - 160, 43, 30, x === monitor.desk ? (monitorPhase().active ? '#fff4bb' : monitorPhase().warning ? '#e9c98e' : '#9db6c4') : '#9db6c4');
        rod(x + 70, F - 125, x + 70, F - 105, 5, C.steel);
        rect(x + 40, F - 112, 63, 5, '#526274');
    }
    function person(n: DeepReadonly<Person>) {
        const x = n.x;
        const y = F - 20;
        rod(x - 7, y - 40, x - 10, y, 8, '#565e70');
        rod(x + 5, y - 40, x + 10, y, 8, '#565e70');
        polygon([[x - 17, y - 93], [x + 10, y - 93], [x + 18, y - 41], [x - 20, y - 41]], '#727d8b');
        polygon([[x - 9, y - 93], [x + 5, y - 93], [x - 1, y - 69]], C.shirt);
        rect(x - 2, y - 88, 4, 24, '#9e6955');
        rod(x - 14, y - 86, x - 29, y - 55, 8, '#727d8b');
        rod(x - 29, y - 55, x - 4, y - 63, 7, '#727d8b');
        polygon([[x - 13, y - 124], [x + 5, y - 132], [x + 17, y - 113], [x + 10, y - 96], [x - 8, y - 99]], C.skin);
        polygon([[x - 14, y - 122], [x + 4, y - 134], [x + 14, y - 125], [x + 1, y - 125], [x - 10, y - 114]], '#49505b');
        rect(x + 7, y - 114, 2, 3, C.ink);
    }
    function binBack() {
        rect(bin.a - 8, F - 16, 176, 10, '#5b6e70');
        polygon([[bin.a + 5, F - 7], [bin.b - 5, F - 7], [bin.b - 16, bin.bottom], [bin.a + 16, bin.bottom]], '#687b7d');
        ellipse(bin.x, F - 8, 79, 12, '#303d44');
        label('紙 / PAPER', bin.x, F - 30, 12);
    }
    function binFront() {
        polygon([[bin.a + 5, F + 3], [bin.b - 5, F + 3], [bin.b - 16, bin.bottom], [bin.a + 16, bin.bottom]], '#8d9c96');
        for (let x = bin.a + 23; x < bin.b - 10; x += 18) {
            rod(x, F + 15, x + 4, bin.bottom - 12, 2, '#6e807c');
        }
        ellipse(bin.x, F + 3, 78, 7, '#a4b1a5');
        rect(bin.x - 27, F + 35, 54, 29, '#d7dcc7');
        label('분리배출', bin.x, F + 54, 11);
        if (inBin) {
            label('GAME OVER', bin.x, F - 117, 15, '#79472c');
        }
    }
    function cleaningDraw() {
        const spread = cleaning.spilled ? Math.min(1, cleaning.age / .8) : 0;
        if (spread > 0) {
            for (let i = 0; i < 11; i++) {
                const x = cleaning.a + 15 + i * 30 * spread;
                ellipse(x, F + 3, Math.max(2, (24 + i % 3 * 7) * spread), 4 + i % 2 * 2, '#7f8970');
            }
            ellipse(cleaning.a + 155 * spread, F + 2, 85 * spread, 3, '#a1a88b');
            rod(cleaning.a + 70 * spread, F + 2, cleaning.a + 130 * spread, F + 2, 1, '#c0c7a4');
        }
        // A mop and wheeled cleaning bucket are ordinary office props; the bucket tips as the chair approaches.
        const tip = cleaning.spilled ? Math.min(1, cleaning.age / .42) : 0;
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
        rod(cleaning.x + 42, F - 5, cleaning.x + 20 + tip * 50, F - 137 + tip * 81, 5, '#9eaa9e');
        for (let i = 0; i < 6; i++) {
            rod(cleaning.x + 25 + i * 7, F - 10, cleaning.x + 20 + i * 9, F + 3, 3, '#999e81');
        }
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
        label(cleaning.spilled ? (cleaning.age < 1.4 ? '촤아악!!' : '더러운 물 · 미끄러움') : '청소 중 · 물통 조심', 1045, F - 56, 14, cleaning.spilled ? '#586d50' : '#756846');
    }
    function monitorDraw() {
        const m = monitorPhase();
        const x = monitor.x;
        const y = monitor.y;
        // The light starts inside the screen of the ordinary monitor on the last desk.
        label(m.active ? '푸슝— 푸슝!' : m.warning ? '화면 반사 예고…' : '빛이 꺼졌다 · 지금 통과', x, y - 35, 13, m.active ? '#ffe0a6' : '#e1e6ee');
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
            const blink = .45 + .55 * Math.sin(charge * Math.PI * 3) ** 2;
            ellipse(x - 3, y - 2, 4 + charge * 5, 3 + charge * 3, tint('#fff4c6', blink * .65));
            rod(x - 5, y - 21, x - 5, y - 29 - charge * 5, 2, '#dca468');
            rod(x - 22, y - 16, x - 28 - charge * 4, y - 23, 2, '#dca468');
        }
        for (let i = 0; i < 4; i++) {
            rect(monitor.wall - 58 + i * 20, F + 10, 11, 3, '#c79c64');
        }
        label(m.active ? '빛이 꺼질 때까지 대기' : m.warning ? '잠깐, 곧 눈부셔요!' : '→ 통과', monitor.wall - 50, F + 43, 12, '#735f46');
    }
    function player() {
        ox = p.x + ART.player.offsetX;
        oy = p.y + ART.player.offsetY;
        rotation = p.a;
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
        rod(-4, -22, 27, -19, 13, '#535c70');
        rod(27, -19, 38, 3, 10, '#535c70');
        rect(31, 0, 25, 8, '#393c46');
        polygon([[-18, -64], [4, -62], [14, -24], [-12, -23]], C.shirt);
        rod(0, -62, 0, -69, 7, C.skin);
        polygon([[-12, -88], [4, -94], [15, -81], [12, -66], [-4, -64], [-13, -75]], C.skin);
        polygon([[-14, -85], [-4, -97], [7, -94], [14, -86], [2, -88], [-9, -79]], '#3c3b43');
        rect(4, -84, 10, 6, '#c3d0d0');
        rod(1, -84, 15, -84, 2, C.ink);
        rect(9, -82, 2, 2, C.ink);
        rod(-10, -55, 6, -38, 8, C.shirt);
        rod(6, -38, 32, -34, 6, C.skin);
        rod(1, -57, 8, -37, 3, '#ac6954');
        polygon([[21, -31], [54, -31], [65, -59], [33, -59]], '#555f70');
        polygon([[35, -55], [59, -55], [51, -35], [27, -35]], '#a8b9c3');
        rod(18, -29, 55, -29, 3, C.steel);
        const tap = Math.sin(t * 24) * 1.8;
        rect(26, -35 + tap, 8, 3, C.skin);
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
        ox = oy = rotation = 0;
        localScale = 1;
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
        rect(cam, 287, VW, F - 287, '#a0a7b1');
        rod(cam, 315, cam + VW, 315, 2, '#8c94a1');
        for (let x = 110; x < GOAL; x += 420) {
            if (x < left - 200 || x > right) {
                continue;
            }
            desk(x);
            plant(x + 205);
        }
        for (const n of people) {
            if (n.x > left && n.x < right) {
                person(n);
            }
        }
        for (const ob of solids) {
            polygon(ob.p.map(v => [v.x, v.y]), C.floor);
        }
        for (let x = Math.floor(cam / 110) * 110; x < right; x += 110) {
            if (x > bin.a - 30 && x < bin.b + 30) {
                continue;
            }
            rod(x, F + 5, x - 35, F + 150, 1, '#a1a5ad');
        }
        cleaningDraw();
        const x = copier.x;
        rect(x - 56, F - 108, 112, 88, '#c6c9bf');
        rect(x - 48, F - 96, 40, 61, '#aeb7b5');
        rect(x - 1, F - 96, 47, 22, '#717f88');
        rect(x + 6, F - 91, 21, 9, copier.flash > 0 ? '#edc883' : '#9fbdad');
        rect(x - 56, F - 120, 112, 12, '#dcdccc');
        polygon([[x - 45, F - 121], [x + 35, F - 132], [x + 48, F - 151], [x - 35, F - 143]], '#e7e4d6');
        rect(x - 65, F - 91, 22, 7, '#333d49');
        rect(x + 42, F - 91, 23, 7, '#333d49');
        for (let j = 0; j < 3; j++) {
            rect(x - 37, F - 70 + j * 11, 22, 3, '#737f87');
        }
        label(copier.flash > 0 ? '퉤! 퉷!!' : '자동 출력 · 접근 감지', x, F - 167, 14, copier.flash > 0 ? '#ffd5a8' : '#e1e6ee');
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
        label('사무실 출입문 →', GOAL + 18, F - 218, 12, '#f0eddc');
        if (glare > 0) {
            rect(cam, -vertical, VW, H / scale, '#fff7d5' + Math.round(Math.min(.22, glare * .16) * 255).toString(16).padStart(2, '0'));
            label('으… 눈부셔!', p.x, p.y - 119, 15, '#856e4e');
        }
        if (mode === 'impact') {
            label('머리 충돌 · 0.25×', p.x, 120, 17, '#974c41');
        }
        if (mode === 'pause') {
            rect(cam, -vertical, VW, H / scale, '#3a455d');
            label('잠깐, 숨 고르는 중', cam + VW / 2, H / scale / 2 - vertical, 22, '#eee8d7');
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
        ({ player: p, mode, cleaning, people, solids, papers, inBin, soaked, dirty, time: t } = state);
        monitor = { ...state.monitor, ...ART.monitor };
        bin = { ...state.bin, bottom: ART.binBottom };
        copier = { ...state.copier, flash: effects.copierFlash };
        ({ waterDrops, waterRipples, specks, paperFace, glare } = effects);
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
        world();
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
