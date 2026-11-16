// GPU queries complete asynchronously; CPU render timing only measures command
// submission.

const TIME_ELAPSED_EXT = 0x88bf;
const GPU_DISJOINT_EXT = 0x8fbb;
const MAX_PENDING = 8;

export type GpuTimer = {
    begin(): boolean;
    end(): void;
    collect(): number[];
    dispose(): void;
};

export type TimerGl = Pick<
    WebGL2RenderingContext,
    | 'createQuery'
    | 'deleteQuery'
    | 'beginQuery'
    | 'endQuery'
    | 'getQueryParameter'
    | 'getParameter'
    | 'getExtension'
    | 'QUERY_RESULT'
    | 'QUERY_RESULT_AVAILABLE'
>;

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
            while (
                pending.length &&
                gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)
            ) {
                const query = pending.shift()!;
                out.push(
                    Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6,
                );
                recycle(query);
            }
            return out;
        },
        dispose() {
            if (active) gl.endQuery(TIME_ELAPSED_EXT);
            for (const query of [
                ...pending,
                ...spare,
                ...(active ? [active] : []),
            ]) {
                gl.deleteQuery(query);
            }
            pending.length = spare.length = 0;
            active = null;
        },
    };
}
