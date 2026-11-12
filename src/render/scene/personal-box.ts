import type { RenderCtx } from '../context';
import { PERSONAL_BOX, personalBoxPose } from '../personal-box-motion';
import { personalBoxBadge } from './personal-box-badge';

// A desk cleared in a hurry: personal belongings, open flaps and a clipped badge lanyard.
export function personalBox(ctx: RenderCtx) {
    const { ox, oy, rotation, localScale } = ctx;
    ctx.ox = PERSONAL_BOX.x;
    ctx.oy = PERSONAL_BOX.y;
    ctx.rotation = 0;
    ctx.localScale = PERSONAL_BOX.scale;
    ctx.ellipse(58, 56, 76, 5, '#23394f55');
    ctx.polygon([[0, 4], [17, -10], [111, -10], [126, 4], [111, 19], [0, 19]], '#725f50');
    ctx.polygon([[17, -10], [12, -26], [107, -26], [111, -10]], '#bba082');
    ctx.rod(17, -10, 111, -10, 1, '#e0c3a0');
    packedPapers(ctx);
    mug(ctx);
    plant(ctx);
    cartonFront(ctx);
    personalBoxBadge(ctx);
    ctx.ox = ox;
    ctx.oy = oy;
    ctx.rotation = rotation;
    ctx.localScale = localScale;
}

function cartonFront(ctx: RenderCtx) {
    ctx.gradientPolygon([[0, 4], [108, 4], [108, 56], [0, 56]],
        ctx.gradientFill(0, 4, 108, 56, [[0, '#baa187'], [1, '#927960']]));
    ctx.polygon([[108, 4], [126, -9], [126, 44], [108, 56]], '#796955');
    ctx.polygon([[0, 4], [-16, -7], [-8, 12], [0, 21]], '#cbb295');
    ctx.polygon([[108, 4], [126, -9], [140, -1], [121, 13]], '#baa187');
    ctx.rod(0, 5, 108, 5, 2, '#e0c3a0');
    ctx.rod(108, 6, 108, 54, 1.5, '#d2b99b');
    ctx.rod(0, 55, 107, 55, 2, '#75634f');
    ctx.rod(43, 22, 70, 22, 7, '#544f4a');
    ctx.rod(44, 24, 69, 24, 1, '#d2b99b');
    ctx.polygon([[18, 5], [30, 5], [27, 18], [23, 15], [20, 19]], '#d7c4a075');
    ctx.rod(4, 43, 13, 51, 1, '#75634f');
    ctx.rod(94, 49, 103, 41, 1, '#75634f');
}

function packedPapers(ctx: RenderCtx) {
    ctx.polygon([[7, 4], [0, -37], [25, -41], [34, 5]], '#566e85');
    ctx.polygon([[11, 3], [4, -33], [23, -36], [30, 4]], '#e5e1d1');
    ctx.polygon([[15, 3], [10, -29], [29, -32], [34, 4]], '#f2ead5');
    ctx.rod(7, -32, 23, -35, 1, '#a5afb0');
    ctx.polygon([[29, 3], [25, -22], [38, -23], [42, 4]], '#8d9c9b');
}

function mug(ctx: RenderCtx) {
    ctx.strokePath([60, -12], [[77, -17, 77, 6, 62, 3]],
        { width: 4, color: '#dce4dc', cap: 'round' });
    ctx.gradientPolygon([[40, -15], [62, -15], [60, 5], [42, 5]],
        ctx.gradientFill(40, 0, 62, 0, [[0, '#e9eee1'], [.6, '#bdcdd0'], [1, '#8ea4ae']]));
    ctx.ellipse(51, 5, 9, 2.4, '#a6bac1');
    ctx.ellipse(51, -15, 11, 3, '#edf0e4');
    ctx.ellipse(51, -15, 8, 2, '#687b84');
    ctx.ellipse(51, -14.5, 6, 1, '#584d47');
    ctx.rod(43, -11, 44, 0, 1.2, '#f9f4e5');
}

function plant(ctx: RenderCtx) {
    const pose = personalBoxPose(ctx.personalBox, ctx.t);
    const tipX = 95 + Math.sin(pose.bend) * 34, tipY = -24 - Math.cos(pose.bend) * 34;
    ctx.strokePath([94, -23], [[94, -32, tipX, -44, tipX, tipY]], { width: 2, color: '#617e72', cap: 'round' });
    plantLeaves(ctx, pose.bend, pose.leaf);
    ctx.gradientPolygon([[80, -25], [110, -25], [106, 1], [85, 1]],
        ctx.gradientFill(80, 0, 110, 0, [[0, '#be8c73'], [1, '#805e54']]));
    ctx.ellipse(95, -25, 17, 4, '#cca58c');
    ctx.ellipse(95, -26, 13, 2.5, '#514a46');
    ctx.rod(83, -20, 107, -20, 2, '#cca58c');
}

function plantLeaves(ctx: RenderCtx, bend: number, leaf: number) {
    const { ox, oy, rotation } = ctx;
    ctx.ox += 95 * ctx.localScale;
    ctx.oy -= 24 * ctx.localScale;
    ctx.rotation = bend;
    ctx.effectPath([0, -19], [[-12, -41, -22, -35, -18, -24], [-14, -15, -5, -19, 0, -19]], '#6f8d7f');
    const flutter = leaf * 40;
    ctx.effectPath([0, -25], [[9 + flutter, -47, 24 + flutter, -42, 19 + flutter, -32],
        [15, -23, 6, -26, 0, -25]], '#9eafa0');
    ctx.effectPath([0, -7], [[-9, -24, -22, -18, -16, -10], [-12, -4, -5, -8, 0, -7]], '#879e8b');
    ctx.effectPath([0, -12], [[12, -26, 22, -17, 16, -11], [11, -6, 5, -11, 0, -12]], '#5b7c70');
    ctx.ox = ox;
    ctx.oy = oy;
    ctx.rotation = rotation;
}
