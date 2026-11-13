import type { RenderCtx } from '../context';

// Office staff behind the floating facade. Local units: origin at the window's floor centre, facing right.
type Look = { skin: string; shade: string; hair: string; shirt: string; fold: string; tie: string | null; pants: string; long: boolean };
type Pose = 'typing' | 'asleep' | 'waving';

const LOOKS: readonly Look[] = [
    { skin: '#e4cba6', shade: '#c9a983', hair: '#3c424f', shirt: '#f1eee4', fold: '#d3cfc2', tie: '#c8463b', pants: '#3f4a5c', long: false },
    { skin: '#c99a72', shade: '#a97c58', hair: '#1f2329', shirt: '#9fc2d8', fold: '#7fa3bb', tie: '#2f4f7a', pants: '#2e3646', long: true },
    { skin: '#f0d6bb', shade: '#d4b494', hair: '#8a5a3a', shirt: '#f3d9a4', fold: '#d6bb84', tie: null, pants: '#5a4a44', long: true },
    { skin: '#8d6447', shade: '#6f4c34', hair: '#24201e', shirt: '#e8e2cc', fold: '#c8c2ac', tie: '#3f7a52', pants: '#33394a', long: false },
    { skin: '#e8c7a0', shade: '#cba57c', hair: '#b9b3a8', shirt: '#56657c', fold: '#45526a', tie: '#e0503f', pants: '#2a3140', long: false },
    { skin: '#dcb48c', shade: '#bf956c', hair: '#5b3424', shirt: '#d98f8a', fold: '#b9706c', tie: null, pants: '#46506a', long: true },
];

function head(ctx: RenderCtx, L: Look, x: number, y: number, look: number, closed = false) {
    ctx.ellipse(x - 5.6, y + 1, 1.6, 2.2, L.shade);
    ctx.ellipse(x, y, 6.4, 7.4, L.skin);
    ctx.ellipse(x - 1.5, y + 4.2, 4.2, 2.6, L.shade + '55');
    // Hair: a cap over the crown and back; long hair falls behind the ear.
    ctx.effectPath([x - 6.8, y + (L.long ? 7 : 1)], [[x - 8, y - 6, x - 3, y - 10.5, x + 3, y - 8.8], [x + 6.8, y - 7.6, x + 7.2, y - 4, x + 6, y - 3.2],
        [x + 2, y - 5.6, x - 2, y - 4.6, x - 4.2, y - 1], [x - 4.6, y + 2, x - 4.4, y + (L.long ? 6 : 2), x - 6.8, y + (L.long ? 7 : 1)]], L.hair);
    ctx.ellipse(x - 5.6, y + .8, 1.4, 2, L.skin);
    // Nose, eye and mouth on the side facing right; the pupil follows the flying chair.
    ctx.polygon([[x + 6, y - 1], [x + 8.3, y + 2], [x + 6.2, y + 2.6]], L.skin);
    if (closed) ctx.rod(x + 2.4, y - .8, x + 5, y - .4, .7, '#2a2a30');
    else {
        ctx.ellipse(x + 3.6, y - .8, 1.7, 1.8, '#ffffff');
        ctx.ellipse(x + 3.6 + look * .8, y - .8, 1, 1.1, '#262a33');
    }
    ctx.rod(x + 2.2, y - 3.6, x + 5.4, y - 3.9, .8, L.hair);
    ctx.rod(x + 3.4, y + 4.4, x + 5.6, y + 4.1, .7, '#9c6a55');
}

function torso(ctx: RenderCtx, L: Look, x: number, y: number, lean = 0) {
    ctx.polygon([[x - 6 + lean, y - 21], [x + 5 + lean, y - 21], [x + 6, y], [x - 7, y]], L.shirt);
    ctx.polygon([[x - 6 + lean, y - 21], [x - 2 + lean, y - 21], [x - 3, y], [x - 7, y]], L.fold);
    ctx.polygon([[x + lean - 1, y - 21], [x + lean + 3.5, y - 21], [x + lean + 1.4, y - 17]], '#ffffff');
    if (L.tie) ctx.polygon([[x + lean + .6, y - 19.5], [x + lean + 2.4, y - 19.5], [x + lean + 2.6 - lean * .3, y - 9], [x + lean + 1.4 - lean * .3, y - 7], [x + lean + .2 - lean * .3, y - 9]], L.tie);
}

function seated(ctx: RenderCtx, L: Look, x: number) {
    // Office chair, then thighs, shins and shoes.
    ctx.rect(x - 11, -44, 4, 22, '#2f3a4c');
    ctx.rect(x - 12, -23, 18, 3.5, '#2f3a4c');
    ctx.rod(x - 2, -20, x - 2, -6, 2, '#7e91a5');
    ctx.rod(x - 9, -3, x + 5, -3, 1.6, '#7e91a5');
    ctx.ellipse(x - 9, -1.5, 1.6, 1.6, '#262c38');
    ctx.ellipse(x + 5, -1.5, 1.6, 1.6, '#262c38');
    ctx.polygon([[x - 7, -27], [x + 9, -27], [x + 10, -21], [x - 7, -20]], L.pants);
    ctx.polygon([[x + 6, -25], [x + 10, -25], [x + 11, -5], [x + 7, -5]], L.pants);
    ctx.ellipse(x + 11, -3.6, 4.4, 2, '#22262e');
}

function arm(ctx: RenderCtx, L: Look, from: [number, number], elbow: [number, number], hand: [number, number]) {
    ctx.rod(from[0], from[1], elbow[0], elbow[1], 3.8, L.fold);
    ctx.rod(elbow[0], elbow[1], hand[0], hand[1], 3.2, L.shirt);
    ctx.ellipse(hand[0], hand[1], 2, 1.8, L.skin);
}

function desk(ctx: RenderCtx, t: number) {
    ctx.rect(6, -26, 18, 2.6, '#e8bb79');
    ctx.rect(6, -23.4, 18, 1, '#b98d55');
    ctx.rect(21, -23, 2, 23, '#455e76');
    ctx.rect(18, -43, 3.4, 15, '#2c3a50');
    ctx.rect(19.6, -28, 1.4, 2, '#455e76');
    ctx.rect(15, -26.6, 4, 1, '#3c4658');
    // Screen light falls back onto the worker's face.
    ctx.beginLayer({ key: 'sky-office-screen', blend: 'add', opacity: .55 + Math.sin(t * 13) * .05 });
    ctx.ellipse(13, -36, 11, 10, ctx.radialFill(19, -36, 12, [[0, '#7fc8ff'], [1, '#7fc8ff00']]));
    ctx.endLayer();
}

function worker(ctx: RenderCtx, pose: Pose, L: Look, t: number, look: number) {
    if (pose === 'typing') {
        desk(ctx, t);
        seated(ctx, L, -8);
        torso(ctx, L, -8, -26, 1.5);
        const tap = Math.sin(t * 22) * 1.1;
        arm(ctx, L, [-5, -44], [1, -34], [12, -28.5 + tap]);
        head(ctx, L, -6, -54, look);
    } else if (pose === 'asleep') {
        desk(ctx, t);
        seated(ctx, L, -8);
        // Slumped forward, head down on the desk, breathing slowly, with a rising snore of Z shapes.
        const breath = Math.sin(t * 1.6) * .6;
        ctx.polygon([[-15, -26], [-2, -26], [7, -35 + breath], [-3, -45 + breath]], L.shirt);
        ctx.polygon([[-15, -26], [-10, -26], [-4, -39 + breath], [-3, -45 + breath]], L.fold);
        arm(ctx, L, [1, -40 + breath], [9, -29], [16, -28]);
        head(ctx, L, 8, -33 + breath, 0, true);
        for (let i = 0; i < 3; i++) {
            const k = (t * .45 + i / 3) % 1;
            const zx = 10 + k * 8 + i, zy = -42 - k * 24, s = 1.4 + k * 1.6;
            ctx.strokePath([zx - s, zy - s], [[zx + s, zy - s, zx + s, zy - s, zx + s, zy - s], [zx - s, zy + s, zx - s, zy + s, zx - s, zy + s],
                [zx + s, zy + s, zx + s, zy + s, zx + s, zy + s]], { width: .9, color: ctx.tint('#2f3a4c', 1 - k), cap: 'round' });
        }
    } else {
        // Standing at the glass, waving at the flying chair.
        const sway = Math.sin(t * 2) * .8;
        ctx.polygon([[-8, -27], [-1, -27], [-2, -3], [-7, -3]], L.pants);
        ctx.polygon([[-3, -27], [3, -27], [4, -3], [0, -3]], L.pants);
        ctx.ellipse(-4, -2, 4, 1.8, '#22262e');
        ctx.ellipse(3, -2, 4, 1.8, '#22262e');
        torso(ctx, L, -3 + sway * .3, -27, sway * .4);
        const wave = Math.sin(t * 9) * 5;
        arm(ctx, L, [0, -45], [9, -52], [13 + wave * .4, -64 + Math.abs(wave) * .2]);
        ctx.ellipse(13 + wave * .4, -64, 2.6, 3, L.skin);
        arm(ctx, L, [-3, -44], [-2, -34], [1, -26]);
        head(ctx, L, -2 + sway * .4, -56, look);
        ctx.ellipse(4.2 + sway * .4, -51.6, 1.6, 1.2, '#7a3a35');
    }
}

// Only three of the twelve windows are staffed. Slots count left to right, upper row 1-6, lower row 7-12.
const STAFF: Readonly<Record<number, { pose: Pose; look: number; dx: number }>> = {
    2: { pose: 'waving', look: 3, dx: 0 },
    5: { pose: 'typing', look: 1, dx: -2 },
    9: { pose: 'asleep', look: 2, dx: -2 },
};
const SCALE = 1.05;

/** The worker in window `slot`, if any. `left` is the window's left edge and `floor` the room's floor line in world space. */
export function officeWorker(ctx: RenderCtx, slot: number, left: number, floor: number) {
    const staff = STAFF[slot];
    if (!staff) return;
    const x = left + 27.5 + staff.dx;
    const look = Math.max(-1, Math.min(1, (ctx.p.x - x) / 120));
    ctx.ox = x; ctx.oy = floor; ctx.rotation = 0; ctx.localScale = SCALE;
    worker(ctx, staff.pose, LOOKS[staff.look], ctx.t + slot * 1.37, look);
    ctx.ox = ctx.oy = 0; ctx.localScale = 1;
}
