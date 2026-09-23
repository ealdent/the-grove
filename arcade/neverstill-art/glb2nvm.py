"""GLB -> packed NVM1 model record (+ QC render). No deps beyond numpy/PIL."""
import struct, json, sys, io, base64, math, os
import numpy as np
from PIL import Image, ImageDraw

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def load_glb(path):
    b = open(path, 'rb').read()
    magic, ver, length = struct.unpack('<III', b[:12])
    assert magic == 0x46546C67, 'not a GLB'
    off, js, binc = 12, None, b''
    while off < length:
        clen, ctype = struct.unpack('<II', b[off:off + 8]); data = b[off + 8:off + 8 + clen]; off += 8 + clen
        if ctype == 0x4E4F534A: js = json.loads(data)
        elif ctype == 0x004E4942: binc = data
    return js, binc

def accessor(js, binc, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    dt = CT[a['componentType']]; n = NC[a['type']]; cnt = a['count']
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
    if stride and stride != isz:
        raw = np.frombuffer(binc, dtype=np.uint8, count=stride * (cnt - 1) + isz, offset=base)
        arr = np.stack([np.frombuffer(raw[k * stride:k * stride + isz].tobytes(), dtype=dt) for k in range(cnt)])
    else:
        arr = np.frombuffer(binc, dtype=dt, count=cnt * n, offset=base).reshape(cnt, n) if n > 1 else np.frombuffer(binc, dtype=dt, count=cnt, offset=base)
    arr = arr.astype(np.float64)
    if a.get('normalized'):
        arr = arr / float(np.iinfo(dt).max)
    return arr

def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def node_mat(n):
    if 'matrix' in n: return np.array(n['matrix'], dtype=float).reshape(4, 4).T
    M = np.eye(4)
    S = np.diag(n.get('scale', [1, 1, 1])); R = qmat(n.get('rotation', [0, 0, 0, 1]))
    M[:3, :3] = R @ S; M[:3, 3] = n.get('translation', [0, 0, 0])
    return M

def image_of(js, binc, tex_index):
    t = js['textures'][tex_index]; im = js['images'][t['source']]
    if 'bufferView' in im:
        bv = js['bufferViews'][im['bufferView']]
        data = binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    else:
        data = base64.b64decode(im['uri'].split(',', 1)[1])
    return Image.open(io.BytesIO(data)).convert('RGB')

def extract(path):
    js, binc = load_glb(path)
    exts = js.get('extensionsUsed', [])
    assert 'KHR_draco_mesh_compression' not in exts, 'draco-compressed GLB not supported'
    P, N, T, I, img = [], [], [], [], None
    scene = js['scenes'][js.get('scene', 0)]
    def walk(ni, parent):
        n = js['nodes'][ni]; M = parent @ node_mat(n)
        if 'mesh' in n:
            for pr in js['meshes'][n['mesh']]['primitives']:
                at = pr['attributes']
                pos = accessor(js, binc, at['POSITION'])
                nrm = accessor(js, binc, at['NORMAL']) if 'NORMAL' in at else None
                uv = accessor(js, binc, at['TEXCOORD_0']) if 'TEXCOORD_0' in at else np.zeros((len(pos), 2))
                idx = accessor(js, binc, pr['indices']).astype(np.int64) if 'indices' in pr else np.arange(len(pos))
                pw = (M[:3, :3] @ pos.T).T + M[:3, 3]
                base = sum(len(p) for p in P)
                P.append(pw); T.append(uv); I.append(idx + base)
                if nrm is None: nrm = np.zeros_like(pos)
                nw = (np.linalg.inv(M[:3, :3]).T @ nrm.T).T
                N.append(nw)
                nonlocal img
                if img is None and 'material' in pr:
                    mat = js['materials'][pr['material']]
                    bct = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
                    if bct is not None: img = image_of(js, binc, bct['index'])
        for c in n.get('children', []): walk(c, M)
    for ni in scene['nodes']: walk(ni, np.eye(4))
    P = np.concatenate(P); N = np.concatenate(N); T = np.concatenate(T); I = np.concatenate(I).reshape(-1, 3)
    # recompute smooth normals if missing
    if not np.any(N):
        fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
        for k in range(3): np.add.at(N, I[:, k], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    return P, N, T, I, img

def rot_y(deg):
    r = math.radians(deg); c, s = math.cos(r), math.sin(r)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rot_x(deg):
    r = math.radians(deg); c, s = math.cos(r), math.sin(r)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def rot_z(deg):
    r = math.radians(deg); c, s = math.cos(r), math.sin(r)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def normalize(P, N, cfg):
    R = np.eye(3)
    for ax, deg in cfg.get('rot', []):
        R = {'x': rot_x, 'y': rot_y, 'z': rot_z}[ax](deg) @ R
    P = P @ R.T; N = N @ R.T
    lo, hi = P.min(0), P.max(0); ext = hi - lo
    mode = cfg.get('fit', 'box')
    if mode == 'prop':
        # base at y=0, height H0, xz half-extent R0 (non-uniform), centred in xz
        c = (lo + hi) / 2
        P = P - [c[0], lo[1], c[2]]
        sx = cfg['R0'] / max(ext[0] / 2, 1e-6); sz = cfg['R0'] / max(ext[2] / 2, 1e-6); sy = cfg['H0'] / max(ext[1], 1e-6)
        s = np.array([sx, sy, sz])
        if cfg.get('uniformXZ', True): s[0] = s[2] = min(sx, sz)
    else:
        axis = int(np.argmax(ext)) if cfg['axis'] == 'max' else 'xyz'.index(cfg['axis']); k = cfg['size'] / max(ext[axis], 1e-6)
        s = np.array([k, k, k])
        c = (lo + hi) / 2
        P = P - c
        if 'yMin' in cfg: P[:, 1] += (cfg['yMin'] - (lo[1] - c[1]) * k) / k
        if 'zMin' in cfg: P[:, 2] += (cfg['zMin'] - (lo[2] - c[2]) * k) / k
    P = P * s
    N = N / s; N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    return P, N

def pack(P, N, T, I, img, tex_size, emis):
    nV = len(P); assert nV < 65536, 'too many vertices %d' % nV
    lo, hi = P.min(0), P.max(0); sc = np.maximum((hi - lo) / 2, 1e-6); of = (hi + lo) / 2
    q = np.round((P - of) / sc * 32767).clip(-32767, 32767).astype('<i2')
    nq = np.zeros((nV, 4), dtype=np.int8); nq[:, :3] = np.round(N * 127).clip(-127, 127)
    tq = np.round(np.clip(T, 0, 1) * 65535).astype('<u2')
    iq = I.reshape(-1).astype('<u2')
    head = b'NVM1' + struct.pack('<II', nV, len(iq)) + struct.pack('<3f', *sc) + struct.pack('<3f', *of)
    body = q.tobytes()
    while (len(head) + len(body)) % 4: body += b'\0'
    blob = head + body + nq.tobytes() + tq.tobytes() + iq.tobytes()
    tex = img.resize((tex_size, tex_size), Image.LANCZOS) if img else Image.new('RGB', (4, 4), (200, 200, 200))
    tex = tex.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    buf = io.BytesIO(); tex.save(buf, 'PNG', optimize=True)
    return {'b': base64.b64encode(blob).decode(), 't': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), 'e': emis,
            'tris': len(I), 'verts': nV}

def qc(P, T, I, img, out, title):
    """Painter's-algorithm flat render: front(+Z toward viewer), right side(+X toward viewer), top(+Y toward viewer)."""
    views = [('front +Z', lambda p: (-p[:, 0], p[:, 1], p[:, 2])), ('side +X', lambda p: (p[:, 2], p[:, 1], p[:, 0])),
             ('top +Y', lambda p: (-p[:, 0], -p[:, 2], p[:, 1])), ('3/4 rear-left', lambda p: (-(p[:, 0] * 0.7 - p[:, 2] * 0.7), p[:, 1] * 0.9 + (p[:, 0] * 0.7 + p[:, 2] * 0.7) * 0.3, -(p[:, 0] * 0.7 + p[:, 2] * 0.7)))]
    S = 260; sheet = Image.new('RGB', (S * 4, S + 18), (30, 30, 40)); d0 = ImageDraw.Draw(sheet)
    tex = np.asarray(img.resize((256, 256))) if img else None
    ext = np.abs(P).max() * 1.1
    fc = P[I].mean(1)
    for vi, (name, f) in enumerate(views):
        x, y, z = f(P)
        cx, cy, cz = f(fc)
        order = np.argsort(cz)  # far first (smaller z = farther from viewer)
        im = Image.new('RGB', (S, S), (60, 60, 75)); d = ImageDraw.Draw(im)
        for t in order:
            a, b, c = I[t]
            pts = [((x[k] / ext) * S / 2 + S / 2, S / 2 - (y[k] / ext) * S / 2) for k in (a, b, c)]
            if tex is not None:
                uv = T[[a, b, c]].mean(0); col = tuple(int(v) for v in tex[min(255, int(uv[1] * 255)), min(255, int(uv[0] * 255))])
            else: col = (200, 200, 200)
            d.polygon(pts, fill=col)
        sheet.paste(im, (vi * S, 18)); d0.text((vi * S + 4, 3), name, fill=(255, 255, 0))
    d0.text((S * 4 - 200, 3), title, fill=(120, 255, 120))
    sheet.save(out)

if __name__ == '__main__':
    glb, name, cfgjson, outdir, qcdir = sys.argv[1:6]
    cfg = json.loads(cfgjson)
    P, N, T, I, img = extract(glb)
    if 'cutBelow' in cfg:
        R = np.eye(3)
        for ax, deg in cfg.get('rot', []): R = {'x': rot_x, 'y': rot_y, 'z': rot_z}[ax](deg) @ R
        Pr = P @ R.T; lo, hi = Pr.min(0), Pr.max(0); yc = lo[1] + cfg['cutBelow'] * (hi[1] - lo[1])
        keep = Pr[I].mean(1)[:, 1] > yc
        I = I[keep]
        used = np.unique(I); remap = -np.ones(len(P), dtype=np.int64); remap[used] = np.arange(len(used))
        P, N, T, I = P[used], N[used], T[used], remap[I]
        cfg = dict(cfg); cfg.pop('cutBelow')
    P, N = normalize(P, N, cfg)
    rec = pack(P, N, T, I, img, cfg.get('tex', 128), cfg.get('emis', 0.2))
    if cfg.get('nozzle'):
        z0 = P[:, 2].min(); tail = P[P[:, 2] < z0 + 0.06 * (P[:, 2].max() - z0)]
        rec['noz'] = [round(float(tail[:, 0].mean()), 3), round(float(tail[:, 1].mean()), 3), round(float(z0), 3)]
    json.dump(rec, open(os.path.join(outdir, name + '.json'), 'w'))
    qc(P, T, I, img, os.path.join(qcdir, name + '.png'), name)
    lo, hi = P.min(0), P.max(0)
    print(name, 'tris', rec['tris'], 'verts', rec['verts'], 'bbox', np.round(lo, 2).tolist(), np.round(hi, 2).tolist(), 'bytes', len(rec['b']) + len(rec['t']))
