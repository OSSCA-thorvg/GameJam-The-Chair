/**
 * GPU time of the ThorVG WebGL2 canvas, measured with `EXT_disjoint_timer_query_webgl2`.
 *
 * With the GPU renderer, `Canvas.render()` only queues commands, so CPU timing misses most of the cost.
 * A timer query brackets the frame's GL commands and reports, a few frames later, how long the GPU spent
 * on them. Results arrive late and may be dropped (a "disjoint" event such as a clock change voids them),
 * so this feeds averages, not per-frame decisions. Used only by the developer performance overlay.
 *
 * ThorVG WebGL2 캔버스의 GPU 시간. 결과는 몇 프레임 늦게 도착하며 개발자 오버레이에서만 쓴다.
 */

/** Constants of EXT_disjoint_timer_query_webgl2. */
const TIME_ELAPSED_EXT = 0x88bf;
const GPU_DISJOINT_EXT = 0x8fbb;
/** Queries still waiting for a result; beyond this the GPU is far behind and frames go unmeasured. */
const MAX_PENDING = 8;

export type GpuTimer = {
    /** Starts timing this frame's GL commands. Returns false when it cannot measure this frame. */
    begin(): boolean;
    end(): void;
    /** GPU milliseconds of every frame whose result arrived since the last call, oldest first. */
    collect(): number[];
    dispose(): void;
};

/** Minimal WebGL2 surface the timer needs, so tests can pass a stand-in. */
export type TimerGl = Pick<WebGL2RenderingContext,
    'createQuery' | 'deleteQuery' | 'beginQuery' | 'endQuery' | 'getQueryParameter' | 'getParameter' | 'getExtension'
    | 'QUERY_RESULT' | 'QUERY_RESULT_AVAILABLE'>;

/** A timer for `gl`, or null when the browser does not expose GPU timer queries (common outside Chrome). */
export function createGpuTimer(gl: TimerGl | null): GpuTimer | null {
    if (!gl || !gl.getExtension('EXT_disjoint_timer_query_webgl2')) return null;
    const pending: WebGLQuery[] = [];
    const spare: WebGLQuery[] = [];
    let active: WebGLQuery | null = null;

    function recycle(query: WebGLQuery) {
        spare.push(query);
    }

    return {
        begin() {
            if (active || pending.length >= MAX_PENDING) return false;
            const query = spare.pop() ?? gl.createQuery();
            if (!query) return false;
            gl.beginQuery(TIME_ELAPSED_EXT, query);
            active = query;
            return true;
        },
        end() {
            if (!active) return;
            gl.endQuery(TIME_ELAPSED_EXT);
            pending.push(active);
            active = null;
        },
        collect() {
            const out: number[] = [];
            // A disjoint event makes every outstanding result meaningless.
            if (gl.getParameter(GPU_DISJOINT_EXT)) {
                for (const query of pending.splice(0)) recycle(query);
                return out;
            }
            // Results complete in submission order, so stop at the first one still running.
            while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
                const query = pending.shift()!;
                out.push(Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6);
                recycle(query);
            }
            return out;
        },
        dispose() {
            if (active) gl.endQuery(TIME_ELAPSED_EXT);
            for (const query of [...pending, ...spare, ...(active ? [active] : [])]) gl.deleteQuery(query);
            pending.length = spare.length = 0;
            active = null;
        },
    };
}
