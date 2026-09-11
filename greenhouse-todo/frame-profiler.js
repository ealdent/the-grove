// Nonblocking GPU timings. Never gl.finish() or spin on a pending query: doing
// that would change the workload we are trying to measure.
export class FrameProfiler {
    constructor(renderer) {
        this.gl = renderer.getContext();
        this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
        this.pending = [];
        this.active = null;
        this.frame = 0;
        this.gpuMs = null;
    }
    begin() {
        if (!this.ext) return;
        const gl = this.gl;
        // Disjoint status is context-wide and cleared on read. Every pending
        // measurement is invalid, even if its result is not available yet.
        if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
            for (const query of this.pending) gl.deleteQuery(query);
            this.pending.length = 0;
            this.gpuMs = null;
            return;
        }
        if (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
            const query = this.pending.shift();
            this.gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
            gl.deleteQuery(query);
        }
        if (this.frame++ % 6 || this.pending.length >= 4) return;
        this.active = gl.createQuery();
        gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active);
    }
    end() {
        if (!this.active) return;
        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        this.pending.push(this.active);
        this.active = null;
    }
}
