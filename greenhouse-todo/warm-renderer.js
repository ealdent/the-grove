const DEADLINE_MS = 30000;

/** Submit one unculled frame, then wait asynchronously for its GPU fence.
 * Call after assets, batch refresh and compile; renderFrame must synchronously
 * render the intended composer/lighting state. Invalidate cached shadows first
 * if their passes also need warming. Invisible source roots stay invisible.
 * Returns { status, rendered, elapsedMs }; only "complete" confirms the fence.
 * WebGL2 sync is core (no timing extension needed); WebGL1 is "unsupported".
 * Render/API exceptions reject after cleanup. The deadline cannot interrupt a
 * synchronous render/driver stall, and one frame cannot cover future variants.
 */
export async function warmRenderer(renderer, scene, renderFrame, requestFrame = requestAnimationFrame) {
    const start = performance.now();
    const deadline = start + DEADLINE_MS;
    const gl = renderer.getContext();
    let rendered = false;
    const result = status => ({ status, rendered, elapsedMs: performance.now() - start });
    if (gl.isContextLost()) return result('context-lost');

    const changed = [];
    try {
        scene.traverseVisible(object => {
            if (!object.isMesh) return;
            changed.push([object, object.frustumCulled]);
            object.frustumCulled = false;
        });
        renderFrame();
        rendered = true;
    } finally {
        // Restore before yielding so ordinary frames never inherit warmup flags.
        for (const [object, culled] of changed) object.frustumCulled = culled;
    }

    if (gl.isContextLost()) return result('context-lost');
    if (!['fenceSync', 'clientWaitSync', 'deleteSync', 'flush'].every(name => typeof gl[name] === 'function')) {
        gl.flush?.();
        return result('unsupported');
    }

    let fence, timer, frame;
    let stopped = false;
    try {
        fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        if (!fence) return result(gl.isContextLost() ? 'context-lost' : 'fence-unavailable');
        return await new Promise((resolve, reject) => {
            const finish = status => { stopped = true; resolve(result(status)); };
            const poll = () => {
                if (stopped) return;
                try {
                    if (gl.isContextLost()) return finish('context-lost');
                    if (performance.now() >= deadline) return finish('timeout');
                    const status = gl.clientWaitSync(fence, 0, 0);
                    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return finish('complete');
                    if (status !== gl.TIMEOUT_EXPIRED) return finish(gl.isContextLost() ? 'context-lost' : 'wait-failed');
                    frame = requestFrame(poll);
                } catch (error) {
                    stopped = true;
                    reject(error);
                }
            };
            // A paused/hidden tab may never deliver the requested animation frame.
            timer = setTimeout(() => finish(gl.isContextLost() ? 'context-lost' : 'timeout'),
                Math.max(0, deadline - performance.now()));
            frame = requestFrame(poll);
        });
    } finally {
        stopped = true;
        clearTimeout(timer);
        if (frame !== undefined && requestFrame === globalThis.requestAnimationFrame) {
            globalThis.cancelAnimationFrame?.(frame);
        }
        if (fence) gl.deleteSync(fence);
    }
}
