import type { RenderCtx } from '../context';
import { personalBoxPose } from '../personal-box-motion';
import type { Vector } from '../types';

export function personalBoxBadge(ctx: RenderCtx) {
    const { ox, oy, rotation, localScale } = ctx;
    ctx.ox += 130 * localScale;
    ctx.oy -= 30 * localScale;
    // Keep the portrait readable independently of the small carton.
    ctx.localScale = 1;
    const pose = personalBoxPose(ctx.personalBox, ctx.t);
    ctx.strokePath([-16, 24], [[-15, 12, 8, -14, 0, -3]],
        { width: 2, color: '#455e76', cap: 'round' });
    ctx.rotation = pose.badgeSwing;
    const width = Math.cos(pose.badgeTurn);
    const card: Vector[] = [[-15, 0], [15, 0], [15, 36], [-15, 36]];
    ctx.polygon(card.map(([x, y]) => [x * width, y]), width < 0 ? '#bec8c5' : '#d6ddd7');
    if (width > 0) badgePortrait(ctx, width);
    ctx.rod(-3 * width, -2, 3 * width, -2, 3, '#adb7ba');
    ctx.ox = ox;
    ctx.oy = oy;
    ctx.rotation = rotation;
    ctx.localScale = localScale;
}

function badgePortrait(ctx: RenderCtx, width: number) {
    const polygon = (points: Vector[], color: string) => ctx.polygon(points.map(([x, y]) => [x * width, y]), color);
    polygon([[-12, 4], [12, 4], [12, 32], [-12, 32]], '#95acb5');
    polygon([[-11, 32], [-9, 25], [-3, 23], [4, 23], [10, 26], [12, 32]], '#f1eee4');
    polygon([[-6, 10], [6, 10], [7, 19], [3, 24], [-3, 24], [-7, 18]], '#e4cba6');
    polygon([[-8, 14], [-8, 9], [-4, 6], [4, 6], [8, 10], [7, 15], [3, 12], [-3, 12]], '#3c424f');
    polygon([[-8, 14], [8, 14], [8, 19], [-8, 19]], '#50606a');
    polygon([[-7, 15], [-1, 15], [-1, 18], [-7, 18]], '#83c8e4');
    polygon([[1, 15], [7, 15], [7, 18], [1, 18]], '#83c8e4');
    polygon([[-2, 25], [2, 25], [1, 27], [3, 31], [0, 33], [-3, 31], [-1, 27]], '#a65e44');
}
