import type { RenderCtx } from '../context';

// Office staff behind the floating facade. Local units: origin at the window's floor centre, facing right.
type Look = { skin: string; shade: string; hair: string; shirt: string; fold: string; tie: string | null; pants: string; long: boolean };
type Pose = 'typing' | 'phone' | 'stamping';

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

function desk(ctx: RenderCtx, t: number, monitor: boolean) {
    ctx.rect(6, -26, 18, 2.6, '#e8bb79');
    ctx.rect(6, -23.4, 18, 1, '#b98d55');
    ctx.rect(21, -23, 2, 23, '#455e76');
    if (!monitor) return;
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
        desk(ctx, t, true);
        seated(ctx, L, -8);
        torso(ctx, L, -8, -26, 1.5);
        const tap = Math.sin(t * 22) * 1.1;
        arm(ctx, L, [-5, -44], [1, -34], [12, -28.5 + tap]);
        head(ctx, L, -6, -54, look);
    } else if (pose === 'phone') {
        // Handset at the ear, scribbling the caller's demands on a memo pad.
        desk(ctx, t, false);
        ctx.rect(9, -27.6, 10, 1.6, '#fbf6e8');
        for (let i = 0; i < 3; i++) ctx.rod(10, -27 + i * .5, 11 + ((t * 3 + i) % 1) * 6, -27 + i * .5, .3, '#5d6d82');
        ctx.rect(15, -29, 6, 3, '#e8e2cc');
        seated(ctx, L, -8);
        arm(ctx, L, [-7, -44], [-13, -38], [-11, -50]);
        torso(ctx, L, -8, -26, 1);
        head(ctx, L, -6, -54, look);
        ctx.rod(-13, -59, -8.5, -46, 3.4, '#e8e2cc');
        ctx.ellipse(-12.6, -58.4, 2.4, 1.8, '#c8c2ac');
        ctx.ellipse(-8.8, -46.4, 2.4, 1.8, '#c8c2ac');
        ctx.ellipse(-11, -51, 2, 2.2, L.skin);
        ctx.strokePath([-9, -47], [[-4, -40, 4, -34, 16, -29]], { width: .7, color: '#c8c2ac', cap: 'round' });
        const talk = Math.max(0, Math.sin(t * 6));
        ctx.ellipse(-1, -50, .9, .4 + talk * .8, '#6a3b35');
        const scribble = Math.sin(t * 17) * 1.2;
        arm(ctx, L, [-4, -44], [2, -33], [12 + scribble, -29]);
        ctx.rod(12 + scribble, -29, 14 + scribble, -33, .8, '#e0503f');
    } else {
        // Approving a stack of documents one thump of the stamp at a time.
        desk(ctx, t, false);
        const cycle = (t * 1.6) % 1;
        const lift = cycle < .75 ? Math.sin(cycle / .75 * Math.PI / 2) : 1 - (cycle - .75) / .25;
        for (let i = 0; i < 4; i++) ctx.rect(9 + (i % 2) * .6, -27.4 - i * 1.3, 12, 1.2, i % 2 ? '#f3ecd8' : '#fbf6e8');
        const marks = Math.floor(t * 1.6) % 4;
        for (let i = 0; i < marks; i++) ctx.ellipse(11 + i * 3, -32.4, 1.1, .4, '#e0503f');
        seated(ctx, L, -8);
        torso(ctx, L, -8, -26, 2.5);
        arm(ctx, L, [-6, -44], [2, -33], [19, -32]);
        const hand: [number, number] = [14, -34 - lift * 12];
        arm(ctx, L, [-3, -44], [4, -36 - lift * 6], hand);
        ctx.rect(hand[0] - 1.2, hand[1] - 4, 2.4, 5, '#b98d55');
        ctx.ellipse(hand[0], hand[1] - 4.4, 1.8, 1.4, '#8a5a3a');
        ctx.rect(hand[0] - 2.4, hand[1] + 1, 4.8, 1.6, '#e0503f');
        if (lift < .08) ctx.strokePath([hand[0] - 5, hand[1] + 1], [[hand[0] - 7, hand[1], hand[0] - 7, hand[1] - 2, hand[0] - 6, hand[1] - 3]],
            { width: .6, color: '#2f3a4c', cap: 'round' });
        head(ctx, L, -5, -53, Math.max(look, .6));
    }
}

// Only three of the twelve facade cells are windows, each with someone at work. Slots count left to right, upper row 1-6, lower row 7-12.
const STAFF: Readonly<Record<number, { pose: Pose; look: number; dx: number }>> = {
    2: { pose: 'phone', look: 3, dx: -1 },
    5: { pose: 'typing', look: 1, dx: -2 },
    9: { pose: 'stamping', look: 2, dx: -2 },
};
const SCALE = 1.05;

export function hasWorker(slot: number) {
    return slot in STAFF;
}

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
