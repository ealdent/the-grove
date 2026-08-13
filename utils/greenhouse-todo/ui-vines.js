// Living vine border for the to-do dialogs.
//
// A single fullscreen-quad fragment shader on a canvas that is inset *beyond* the
// dialog's bounds, so the strands genuinely run off its edges instead of stopping
// at them. The canvas sits above the panel's background but is drawn with
// premultiplied alpha, and the shader decides per strand whether it reads as
// growing in front of the glass or behind it — so one context gives real weaving
// without a second canvas.
//
// Three geometric decisions carry the whole effect:
//
//   * Everything is parametrised by `s`, the arc length around the panel
//     rectangle to the point where a ray from the panel centre crosses it. A
//     nearest-edge parametrisation would be the obvious choice and is wrong: it
//     is discontinuous all the way along each corner diagonal (approaching the
//     top-right corner diagonally, the "top edge" branch and the "right edge"
//     branch disagree by twice the inset distance), which kinks every strand
//     inside every corner. The ray version is a function of the angle alone, so
//     it is continuous everywhere except the exact centre — which is nowhere near
//     a vine.
//
//   * Every wobble frequency is an integer multiple of 2*pi/perimeter and the
//     leaf spacing divides the perimeter a whole number of times. Without that
//     there is a visible seam where s wraps from perimeter back to 0.
//
//   * A leaf is built in a frame whose origin sits on the stem centre-line and
//     grows outward, rather than as an ellipse centred beside the stem. The
//     second construction only touches the stem when its half-length times the
//     sine of its angle happens to exceed its offset — which, with those drawn
//     from unrelated hashes, is the minority of the time, so most leaves float
//     a pixel or two clear of the vine they belong to.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;      // canvas size, device px
uniform vec4  uPanel;    // panel centre.xy, half-size.xy — device px, y up
uniform float uRadius;   // panel corner radius, device px
uniform float uPx;       // device pixels per CSS pixel
uniform float uTime;     // seconds
uniform float uReveal;   // 0 closed .. 1 fully grown
uniform float uMotion;   // 1 normally, 0 under prefers-reduced-motion

#define TAU 6.28318530718

// Signed distance to a rounded rectangle. Negative inside.
float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Arc length around the rectangle to where the ray from the centre through p
// crosses it. Measured counter-clockwise from the midpoint of the right edge.
// See the header for why this is a ray and not a nearest-edge projection.
float perimS(vec2 p, vec2 b) {
    float ax = max(abs(p.x), 1e-5), ay = max(abs(p.y), 1e-5);
    // Which pair of edges the ray leaves through.
    if (ax * b.y >= ay * b.x) {
        float t = ay * b.x / ax;                       // crossing height, 0..b.y
        if (p.x > 0.0) return (p.y >= 0.0) ? t : (4.0 * b.y + 4.0 * b.x - t);
        return (p.y >= 0.0) ? (2.0 * b.y + 2.0 * b.x - t)
                            : (2.0 * b.y + 2.0 * b.x + t);
    }
    float t = ax * b.y / ay;                           // crossing offset, 0..b.x
    if (p.y > 0.0) return (p.x >= 0.0) ? (b.y + b.x - t) : (b.y + b.x + t);
    return (p.x >= 0.0) ? (3.0 * b.y + 3.0 * b.x + t) : (3.0 * b.y + 3.0 * b.x - t);
}

float hash11(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
vec2  hash21(float n) { return fract(sin(vec2(n, n + 4.7)) * vec2(43758.5453, 22578.1459)); }

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 p = frag - uPanel.xy;
    vec2 half_ = uPanel.zw;
    float perim = 4.0 * (half_.x + half_.y);
    if (perim < 1.0) { gl_FragColor = vec4(0.0); return; }

    float d = sdRoundBox(p, half_, uRadius);   // < 0 inside the panel
    float s = perimS(p, half_);
    float sn = s / perim;
    float t = uTime * uMotion;

    // Accumulated premultiplied colour. Alpha is what hides the panel behind a
    // strand; rgb carries light that is added on top, which is what makes the
    // haloes read as glow rather than paint.
    vec3 rgb = vec3(0.0);
    float alpha = 0.0;

    // Strand table. Each strand gets its own lane at a different distance from the
    // border, rather than all of them oscillating through the same band — six
    // vines sharing one band is not six vines, it is a hedge.
    //
    // Fields: lane offset from the border (px, positive = outside), two wobble
    // harmonics as integer cycles around the perimeter, core half-width, whether
    // it reads as in front of the glass, and where along the perimeter it starts.
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 h = hash21(fi * 3.17 + 1.0);
        bool front = (i == 1 || i == 3);

        float m1 = 2.0 + floor(h.x * 3.0);             // 2..4 cycles
        float m2 = 5.0 + floor(h.y * 4.0);             // 5..8 cycles
        float amp1 = (7.0 + h.x * 9.0) * uPx;
        float amp2 = (2.5 + h.y * 3.5) * uPx;
        // Front strands ride the edge and only just break inside it; back strands
        // fan outward into the dark. Distinct lanes, and one clear band of glass
        // left free down the middle for the dialog's own contents.
        float base = (front ? (2.0 + fi * 3.0) : (14.0 + fi * 9.0)) * uPx;
        float halfW = (front ? 1.35 : 1.05) * uPx;
        float dir = (mod(fi, 2.0) < 1.0) ? 1.0 : -1.0;

        float k1 = TAU * m1 / perim;
        float k2 = TAU * m2 / perim;
        float ph = h.x * TAU;

        // The strand's own offset from the border at this arc length.
        float off = base
                  + amp1 * sin(k1 * s + t * 0.13 * dir + ph)
                  + amp2 * sin(k2 * s - t * 0.21 * dir + ph * 2.3);

        // Growth: each strand creeps outward from its own start point in both
        // directions as uReveal climbs, so the border knits itself together.
        float start = h.y;
        float away = abs(fract(sn - start + 0.5) - 0.5) * 2.0;   // 0..1 both ways
        float grow = 1.0 - smoothstep(uReveal * 1.25 - 0.18, uReveal * 1.25, away);
        if (grow <= 0.001) continue;

        // Taper: thinner as it approaches its growing tip, and thinner at the far
        // end from its root — a vine is not a constant-width tube.
        float taper = mix(0.45, 1.0, 1.0 - away * 0.75);

        float r = abs(d - off);
        float core = 1.0 - smoothstep(halfW * taper * 0.6, halfW * taper * 1.9, r);
        // Tight halo. A wide one reads as a lens effect rather than as damp air
        // around a leaf, and five of them stacked wash the panel edge out entirely.
        float halo = exp(-r * r / (52.0 * uPx * uPx));

        // --- Leaves ---
        // Spacing divides the perimeter a whole number of times, so the ring of
        // leaves closes up instead of butting against a seam.
        float target = 66.0 * uPx;
        float count = max(3.0, floor(perim / target));
        float spacing = perim / count;
        float li = s / spacing;
        float lid = floor(li) + fi * 71.0;
        vec2 lh = hash21(lid);
        float side = (hash11(lid * 1.7) < 0.5) ? -1.0 : 1.0;
        // The blade's frame has its origin ON the stem centre-line: u runs along the
        // strand, v across it, and the leaf grows outward from (0, 0). The obvious
        // construction — centre an ellipse a few px off the stem, rotate it about its
        // own middle — cannot guarantee the blade ever reaches back to the stem,
        // because that needs lLen * sin(angle) to exceed the offset and the two are
        // drawn from unrelated hashes. Any leaf lying along the strand then floats
        // free of it. Growing from the stem outward makes the join structural.
        float u = (fract(li) - 0.5) * spacing;   // along the strand
        float v = d - off;                       // across it, 0 on the stem

        // Which way the blade grows: out from the stem on its own side, leaning along it.
        float lean = (hash11(lid * 2.9) - 0.5) * 1.5;
        vec2 lDir = vec2(sin(lean), side * cos(lean));    // not dir: that is the strand's
        float lLen = (9.0 + lh.x * 6.0) * uPx;
        float lWid = (2.6 + lh.y * 1.9) * uPx;

        float lx = dot(vec2(u, v), lDir);                   // 0 at the stem, lLen at the tip
        float ly = dot(vec2(u, v), vec2(-lDir.y, lDir.x));  // across the blade
        float tx = clamp(lx / max(lLen, 1e-4), 0.0, 1.0);
        // Widest a third of the way up, pinched at both ends: t^0.55 * (1 - t), scaled
        // so its peak is exactly lWid. The floor is a stalk — without it the blade
        // tapers to nothing precisely where it meets the stem, and the join goes
        // sub-pixel and reads as a gap all over again.
        float wid = lWid * 2.74 * pow(max(tx, 1e-4), 0.55) * (1.0 - tx);
        wid = max(wid, (1.0 - smoothstep(0.0, 0.3, tx)) * 0.6 * uPx);
        // Antialiased in real pixels rather than in blade-normalised units, so the
        // narrow ends stay smooth instead of stippling.
        float ends = smoothstep(-0.6 * uPx, 0.4 * uPx, lx)
                   * (1.0 - smoothstep(lLen - 0.6 * uPx, lLen + 0.4 * uPx, lx));
        float leaf = (1.0 - smoothstep(-0.7 * uPx, 0.7 * uPx, abs(ly) - wid)) * ends;
        // Midrib — a bright hairline that makes a blob read as foliage. It runs from
        // the stalk to just short of the tip.
        float rib = (1.0 - smoothstep(0.4 * uPx, 1.5 * uPx, abs(ly)))
                  * (1.0 - smoothstep(lLen * 0.72, lLen * 0.92, lx)) * ends * 0.5;

        float body = max(core, leaf * 0.9);
        float lum = max(halo * 0.30, rib * leaf * 0.7);

        // Colour: deep moss at the root, bright new growth at the tip, and leaves
        // a shade yellower than the stem they hang off. The bright end stops well
        // short of 1 — the glow supplies the vibrancy, and a stem already at full
        // channel value has nowhere to go but flat neon.
        vec3 stemCol = mix(vec3(0.10, 0.26, 0.12), vec3(0.30, 0.62, 0.24), 1.0 - away);
        vec3 leafCol = mix(vec3(0.24, 0.48, 0.18), vec3(0.48, 0.76, 0.30), lh.x);
        vec3 col = mix(stemCol, leafCol, leaf);

        // Depth. A back strand is behind the glass: dimmer, hazier and pushed
        // toward the panel's own colour once it crosses the edge. A front strand is
        // unattenuated at the edge — that is what gives the weave — but fades as it
        // reaches further in, so it never ends up lying across the dialog's text.
        float inside = 1.0 - smoothstep(-2.0 * uPx, 2.0 * uPx, d);
        float deep = smoothstep(12.0 * uPx, 38.0 * uPx, -d);
        float depth = front ? (1.0 - deep * 0.9) : mix(1.0, 0.26, inside);
        vec3 hazed = front ? col : mix(col, vec3(0.30, 0.44, 0.30), inside * 0.55);

        // Aerial perspective, cheaply: a strand in an outer lane is further away,
        // so it is dimmer and cooler. Without this the five lanes read as a flat
        // decal of a frame rather than as vines at different depths.
        float lane = base / uPx;
        float far = 1.0 - clamp(lane / 70.0, 0.0, 1.0) * 0.45;
        vec3 tint = mix(vec3(0.88, 1.0, 0.82), vec3(1.0, 0.94, 0.98), h.y);

        float a = body * grow * depth * far * (front ? 0.9 : 0.62);
        float glow = (lum + body * 0.14) * grow * depth * far;

        // Premultiplied over: alpha occludes, rgb adds.
        rgb = rgb * (1.0 - a) + hazed * tint * a + hazed * tint * glow * 0.58;
        alpha = alpha * (1.0 - a) + a;
    }

    // A faint breath of green light along the border, so the strands sit in an
    // atmosphere instead of floating on nothing. Outside only — inside it fogs the
    // top of the panel.
    float rim = exp(-max(d, 0.0) / (20.0 * uPx))
              * (0.5 + 0.5 * sin(t * 0.5 + sn * TAU))
              * (1.0 - smoothstep(0.0, 6.0 * uPx, -d));
    rgb += vec3(0.13, 0.32, 0.17) * rim * 0.16 * smoothstep(0.0, 0.35, uReveal);

    if (alpha < 0.002 && length(rgb) < 0.002) discard;
    gl_FragColor = vec4(rgb, alpha);
}
`;

function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        // Worth surfacing loudly: a silent shader failure here leaves the dialog
        // looking merely plain, which is easy to mistake for a CSS problem.
        console.error('vine shader:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
    }
    return sh;
}

// One VineFrame per dialog. Owns its canvas, its context and its animation loop.
export class VineFrame {
    // `panel` is the element the vines wrap; `overflow` is how far past its edges
    // the canvas extends, in CSS pixels.
    constructor(panel, { overflow = 96, radius = 18 } = {}) {
        this.panel = panel;
        this.overflow = overflow;
        this.radius = radius;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'gh-vines';
        this.canvas.setAttribute('aria-hidden', 'true');
        // Anchored by left/top only, with the CSS size written explicitly in
        // #resize. `inset: -96px` with `width: auto` looks equivalent and is not:
        // a canvas is a *replaced* element, so an auto width resolves to its
        // intrinsic size — the drawing-buffer width in CSS pixels — and the `right`
        // offset is then dropped as over-constrained. At devicePixelRatio 2 that
        // makes the CSS box twice the size it should be, and the vines sprawl
        // across the viewport at double scale. It only looked right at DPR 1,
        // where buffer size and CSS size happen to coincide.
        this.canvas.style.left = `${-overflow}px`;
        this.canvas.style.top = `${-overflow}px`;
        panel.appendChild(this.canvas);

        this.gl = this.canvas.getContext('webgl', {
            alpha: true,
            premultipliedAlpha: true,
            antialias: false,
            depth: false,
            stencil: false
        });
        this.ok = false;
        this.raf = 0;
        this.reveal = 0;
        this.pinnedReveal = null;
        this.openedAt = 0;
        this.reduced = !!(window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (this.gl) this.#init();

        // The dialog changes height as content swaps in (a validation message, a
        // longer description), and the vines have to follow or they wrap the wrong
        // rectangle.
        if (typeof ResizeObserver !== 'undefined') {
            this.ro = new ResizeObserver(() => { this.dirty = true; });
            this.ro.observe(panel);
        }
        this.dirty = true;
    }

    #init() {
        const gl = this.gl;
        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('vine program:', gl.getProgramInfoLog(prog));
            return;
        }
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        this.u = {};
        for (const n of ['uRes', 'uPanel', 'uRadius', 'uPx', 'uTime', 'uReveal', 'uMotion']) {
            this.u[n] = gl.getUniformLocation(prog, n);
        }
        // Premultiplied source: rgb is already scaled by alpha, so ONE is correct
        // and it lets a fragment add light without occluding what is behind it.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
        this.ok = true;
    }

    #resize() {
        // offsetWidth/offsetHeight, NOT getBoundingClientRect(). The bounding rect
        // includes transforms, and the panel opens with a `scale(0.975)` keyframe —
        // so a resize during that animation bakes in a canvas 2.5 % too small, and
        // nothing ever corrects it because ResizeObserver reports the layout box,
        // which the transform never changed. These are the panel's own untransformed
        // coordinates, which is the right space anyway: the canvas is a child of the
        // panel and inherits the same transform.
        //
        // The padding box specifically (client*, not offset*), because `left`/`top`
        // on an absolutely positioned child are resolved against the padding box.
        // That makes the canvas exactly centred on it, which is what the shader
        // assumes when it puts the panel at the canvas centre.
        const panelW = this.panel.clientWidth;
        const panelH = this.panel.clientHeight;
        if (panelW < 1) return false;
        // A shader this cheap does not need 3x; capping keeps a large dialog on a
        // retina phone from allocating a needlessly big drawing buffer.
        const px = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = panelW + this.overflow * 2;
        const cssH = panelH + this.overflow * 2;
        const w = Math.max(1, Math.round(cssW * px));
        const h = Math.max(1, Math.round(cssH * px));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        // The CSS size has to be stated, not inferred. See the constructor: an auto
        // width on a canvas resolves to the drawing-buffer size, which is `px`
        // times too large on a retina display.
        this.canvas.style.width = `${cssW}px`;
        this.canvas.style.height = `${cssH}px`;
        this.gl.viewport(0, 0, w, h);
        this.px = px;
        this.size = [w, h];
        // gl_FragCoord has its origin at the bottom left, the DOM at the top left,
        // and the panel is centred in the canvas either way — so only the half
        // extents and the pixel ratio actually matter here.
        this.panelUniform = [w * 0.5, h * 0.5, panelW * 0.5 * px, panelH * 0.5 * px];
        this.dirty = false;
        return true;
    }

    open() {
        if (!this.ok) return;
        this.reveal = 0;
        this.pinnedReveal = null;
        this.openedAt = performance.now();
        this.dirty = true;
        if (!this.raf) this.#loop();
    }

    close() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
    }

    // Hold the grow-in at a fixed point, or pass null to let it run. Exists so the
    // animation can be captured part-grown: a screenshot taken any time after the
    // dialog opens catches it finished, and rewinding `openedAt` does not work
    // because the next frame simply recomputes from the clock.
    pin(v) {
        this.pinnedReveal = (v === null || v === undefined) ? null : Math.max(0, Math.min(1, v));
        if (this.pinnedReveal !== null) this.reveal = this.pinnedReveal;
    }

    #loop = () => {
        this.raf = requestAnimationFrame(this.#loop);
        const gl = this.gl;
        if (this.dirty && !this.#resize()) return;
        const now = performance.now();
        // ~1.1 s to knit the border together, ease-out so the last strands settle
        // rather than snapping into place.
        if (this.pinnedReveal !== null && this.pinnedReveal !== undefined) {
            this.reveal = this.pinnedReveal;
        } else {
            const k = Math.min(1, (now - this.openedAt) / 1100);
            this.reveal = this.reduced ? 1 : 1 - Math.pow(1 - k, 3);
        }

        gl.uniform2f(this.u.uRes, this.size[0], this.size[1]);
        gl.uniform4f(this.u.uPanel, ...this.panelUniform);
        gl.uniform1f(this.u.uRadius, this.radius * this.px);
        gl.uniform1f(this.u.uPx, this.px);
        gl.uniform1f(this.u.uTime, now / 1000);
        gl.uniform1f(this.u.uReveal, this.reveal);
        gl.uniform1f(this.u.uMotion, this.reduced ? 0 : 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    dispose() {
        this.close();
        if (this.ro) this.ro.disconnect();
        const lose = this.gl && this.gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        this.canvas.remove();
    }
}
