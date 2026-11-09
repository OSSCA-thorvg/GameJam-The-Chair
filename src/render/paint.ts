import type { Canvas, Shape, ThorVGNamespace } from '@thorvg/webcanvas';
import type { RenderCtx } from './context';
import type { DrawCommand } from './types';

export function paint(
    ctx: RenderCtx,
    TVG: ThorVGNamespace | null,
    tvg: Canvas | null,
    pool: Shape[],
) {
    const commands = ctx.commands;
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
                s.fill(...ctx.rgba(cmd.c));
            } else {
                const g = new TVG.LinearGradient(...cmd.c.from, ...cmd.c.to);
                g.setStops(...cmd.c.stops);
                s.fill(g);
                g.dispose();
            }
            s.visible(true);
            i++;
        }
        for (; i < pool.length; i++) {
            pool[i].visible(false);
        }
        tvg.update().render();
    } else {
        const bg = ctx.bg;
        bg.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        bg.clearRect(0, 0, ctx.W, ctx.H);
        paintCanvas(bg, commands);
    }
    const lg = ctx.lg;
    lg.save();
    // System-font labels sit above the vector canvas, including its actors.
    paintCanvas(lg, ctx.foregroundActors);
    lg.restore();
}

function paintCanvas(bg: CanvasRenderingContext2D, commands: DrawCommand[]) {
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
        } else {
            const g = bg.createLinearGradient(...cmd.c.from, ...cmd.c.to);
            for (const [at, c] of cmd.c.stops) {
                g.addColorStop(at, `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`);
            }
            bg.fillStyle = g;
        }
        bg.fill();
    }
}
