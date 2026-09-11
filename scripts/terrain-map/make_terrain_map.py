#!/usr/bin/env python3
"""Build a self-contained 3D contour / viewshed / skyline page for a US land listing.

Usage (typical):
  python3 make_terrain_map.py --slug gentle-ponds-view \
      --title "57 Gentle Ponds View" --subtitle "7.51 acres in five lots ..." \
      --parcels 451000052387000,451000051649000 --county Cherokee \
      --acres 7.51 --out /path/to/utils/gentle-ponds-view.html

Data: USGS 3DEP (elevation), statewide parcel layers (NC OneMap; Tennessee Property Boundaries), USDA Forest Service (ownership),
OpenStreetMap Overpass (peaks, roads, rivers, places, lake names). No API keys.
Everything downloaded is cached in --workdir so re-runs are fast.
"""
import argparse, base64, gzip, json, math, os, re, subprocess, sys, time
from collections import deque
import numpy as np
from PIL import Image, ImageDraw
from numpy.lib.stride_tricks import sliding_window_view

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
# Statewide parcel layers. Each entry maps the layer's field names onto the common names the
# script uses (id, owner, addr, acres, county). Add a state by adding an entry.
PARCEL_SERVICES = {
    "nc": dict(url="https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query",
               id="parno", owner="ownname", addr="siteadd", acres="gisacres", county="cntyname", county_fmt=str.title),
    "tn": dict(url="https://services1.arcgis.com/YuVBSS7Y1of2Qud1/arcgis/rest/services/Tennessee_Property_Boundaries_Public_Use/FeatureServer/0/query",
               id="PARCELID", owner="OWNER", addr="ADDRESS", acres="DEEDAC", county="COUNTY_NAME", county_fmt=str.title),
}

def log(*a): print(*a, file=sys.stderr, flush=True)

# ---------------------------------------------------------------- fetch helpers
def curl(url, out, data=None, timeout=240, tries=2, ua=UA):
    """GET (or POST when data given) to a file; returns http code as int or 0."""
    for attempt in range(tries):
        cmd = ["curl", "-sL", "-A", ua, "-m", str(timeout), "-o", out, "-w", "%{http_code}", url]
        if data:
            for k, v in data.items(): cmd += ["--data-urlencode", f"{k}={v}"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        code = int(r.stdout.strip() or 0)
        if code == 200 and os.path.getsize(out) > 0: return code
        time.sleep(2)
    return code

def fetch_json(url, out, data=None, timeout=240, tries=2):
    if os.path.exists(out) and os.path.getsize(out) > 0:
        try: return json.load(open(out))
        except Exception: pass
    code = curl(url, out, data, timeout, tries)
    try:
        return json.load(open(out))
    except Exception as e:
        log(f"  ! {os.path.basename(out)}: http {code}, bad JSON ({e})"); return None

def overpass(query, out, timeout=170):
    """Try both mirrors; tolerate failure (returns [] on failure)."""
    if os.path.exists(out) and os.path.getsize(out) > 0:
        try: return json.load(open(out))["elements"]
        except Exception: pass
    for url in OVERPASS * 2:
        code = curl(url, out, {"data": f"[out:json][timeout:{timeout}];{query}"}, timeout + 20, tries=1, ua="terrain-map/1.0 (personal land-map builder)")
        try:
            d = json.load(open(out)); return d["elements"]
        except Exception:
            log(f"  ! overpass {url.split('/')[2]} http {code} (retrying on mirror)")
    log("  ! overpass failed for:", query[:70]); return []

def fetch_dem(bbox, size, out):
    if not (os.path.exists(out) and os.path.getsize(out) > 1000):
        W, S, E, N = bbox
        url = ("https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
               f"?bbox={W},{S},{E},{N}&bboxSR=4326&imageSR=4326&size={size},{size}&format=tiff&pixelType=F32"
               "&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_BilinearInterpolation&f=image")
        code = curl(url, out, timeout=600)
        if code != 200: raise SystemExit(f"3DEP fetch failed ({code}) for {out}")
    a = np.array(Image.open(out), dtype=np.float32)
    if np.isnan(a).any(): a = np.nan_to_num(a, nan=float(np.nanmin(a)))
    return a

# ---------------------------------------------------------------- args
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--slug", required=True)
ap.add_argument("--title", required=True)
ap.add_argument("--subtitle", default="")
ap.add_argument("--parcels", default="", help="comma-separated parcel numbers (parno) that make up the listing")
ap.add_argument("--county", default="Cherokee")
ap.add_argument("--state", default="nc", choices=list(PARCEL_SERVICES))
ap.add_argument("--owner-tracts", default="auto", choices=["auto", "none"], help="also draw the listed owner's other nearby parcels")
ap.add_argument("--lat", type=float); ap.add_argument("--lon", type=float)
ap.add_argument("--acres", type=float)
ap.add_argument("--detail-km", type=float, default=14.5)
ap.add_argument("--wide-km", type=float, default=167)
ap.add_argument("--n", type=int, default=1200)
ap.add_argument("--out", required=True)
ap.add_argument("--workdir", default=None)
ap.add_argument("--template", default=os.path.join(HERE, "template.html"))
args = ap.parse_args()

work = args.workdir or os.path.join(os.environ.get("TMPDIR", "/tmp"), "terrain-" + args.slug)
os.makedirs(work, exist_ok=True)
P = lambda name: os.path.join(work, name)
n = args.n
def rnd(v, k=1): return round(float(v), k)

# ---------------------------------------------------------------- parcels
cfg = PARCEL_SERVICES[args.state]; svc = cfg["url"]
county_val = cfg["county_fmt"](args.county).replace("'", "''")
FIELDS = ",".join([cfg["id"], cfg["owner"], cfg["addr"], cfg["acres"]])
def normalize(feats):
    """Rename the layer's fields to parno/ownname/siteadd/gisacres so the rest of the script is state-agnostic."""
    for f in feats:
        a = f["attributes"]
        f["attributes"] = dict(parno=str(a.get(cfg["id"]) or "").strip(), ownname=str(a.get(cfg["owner"]) or "").strip(),
                               siteadd=str(a.get(cfg["addr"]) or "").strip(), gisacres=float(a.get(cfg["acres"]) or 0))
    return feats
listed_ids = [p.strip() for p in args.parcels.split(",") if p.strip()]
parcel_feats = []
if listed_ids:
    where = f"{cfg['county']}='{county_val}' AND {cfg['id']} IN ({','.join(repr(p) for p in listed_ids)})"
    d = fetch_json(svc, P("parcels_listed.json"), {"where": where, "outFields": FIELDS, "returnGeometry": "true", "outSR": "4326", "f": "json"})
    parcel_feats = normalize((d or {}).get("features", []))
    found = {f["attributes"]["parno"] for f in parcel_feats}
    missing = [p for p in listed_ids if p not in found]
    if missing: log("  ! parcels not found:", missing)
    log(f"listed parcels: {len(parcel_feats)}", [(f['attributes']['siteadd'].strip(), f['attributes']['gisacres']) for f in parcel_feats])

def centroid(feats):
    xs = [p[0] for f in feats for ring in f["geometry"]["rings"] for p in ring]
    ys = [p[1] for f in feats for ring in f["geometry"]["rings"] for p in ring]
    return (sum(ys) / len(ys), sum(xs) / len(xs))

if args.lat is not None and args.lon is not None: lat0, lon0 = args.lat, args.lon
elif parcel_feats: lat0, lon0 = centroid(parcel_feats)
else: raise SystemExit("need --lat/--lon or --parcels")
log(f"center {lat0:.5f}, {lon0:.5f}")

cosl = math.cos(math.radians(lat0))
def bbox_for(km):
    dlat = km / 2 / 111.32; dlon = dlat / cosl
    return (lon0 - dlon, lat0 - dlat, lon0 + dlon, lat0 + dlat)
W, S, E, N = bbox_for(args.detail_km)
WW, WS, WE, WN = bbox_for(args.wide_km)
mppx = (E - W) / n * 111320 * math.cos(math.radians((N + S) / 2)); mppy = (N - S) / n * 111320
Wm, Hm = n * mppx, n * mppy
def to_xy(lon, lat): return ((lon - W) / (E - W) * Wm, (lat - S) / (N - S) * Hm)
def to_rc(lon, lat): return ((N - lat) / (N - S) * n - 0.5, (lon - W) / (E - W) * n - 0.5)
def in_detail(lon, lat): return W <= lon <= E and S <= lat <= N

# other tracts of the same owner inside the detail tile
other_feats = []
if args.owner_tracts == "auto" and parcel_feats:
    owner = parcel_feats[0]["attributes"]["ownname"].strip().replace("'", "''")
    d = fetch_json(svc, P("parcels_owner.json"), {"where": f"{cfg['county']}='{county_val}' AND {cfg['owner']} LIKE '{owner[:30]}%'",
                                                  "geometry": f"{W},{S},{E},{N}", "geometryType": "esriGeometryEnvelope", "inSR": "4326",
                                                  "spatialRel": "esriSpatialRelIntersects",
                                                  "outFields": FIELDS, "returnGeometry": "true", "outSR": "4326", "f": "json"})
    listed_set = {f["attributes"]["parno"] for f in parcel_feats}
    other_feats = [f for f in normalize((d or {}).get("features", [])) if f["attributes"]["parno"] not in listed_set]
    log(f"other same-owner tracts in tile: {len(other_feats)}")

# ---------------------------------------------------------------- elevation
log("fetching elevation…")
detail = fetch_dem((W, S, E, N), n, P("detail_dem.tif"))
wide_src = fetch_dem((WW, WS, WE, WN), 1800, P("wide_dem.tif"))
wide = np.array(Image.fromarray(wide_src).resize((n, n), Image.BILINEAR), dtype=np.float32)
log(f"detail {detail.min():.0f}-{detail.max():.0f} m, wide {wide.min():.0f}-{wide.max():.0f} m")

def pack_i16_delta(q):
    q = q.astype(np.int16)
    d = np.diff(q, axis=1, prepend=np.zeros((q.shape[0], 1), dtype=q.dtype)).astype(np.int16)
    return base64.b64encode(gzip.compress(d.tobytes(), 9)).decode()
def pack_mask(m): return base64.b64encode(gzip.compress(np.packbits(m.ravel()).tobytes(), 9)).decode()

def rasterize(feats):
    im = Image.new("L", (n, n), 0); dr = ImageDraw.Draw(im)
    for f in feats:
        for ring in f["geometry"]["rings"]:
            dr.polygon([(c + 0.5, r + 0.5) for r, c in (to_rc(lon, lat) for lon, lat in ring)], fill=255)
    return np.array(im) > 0

out = dict(bbox=dict(W=W, S=S, E=E, N=N), n=n, mppx=mppx, mppy=mppy,
           detail=dict(b64=pack_i16_delta(np.round(detail * 10)), scale=0.1),
           wide=dict(W=WW, S=WS, E=WE, N=WN, n=n, b64=pack_i16_delta(np.round(wide)), scale=1.0))

parcels = []
for f in parcel_feats + other_feats:
    a = f["attributes"]
    parcels.append(dict(id=a["parno"], acres=a["gisacres"], addr=a["siteadd"].strip(), listed=f in parcel_feats,
                        rings=[[[rnd(x), rnd(y)] for x, y in (to_xy(lon, lat) for lon, lat in ring)] for ring in f["geometry"]["rings"]]))
out["parcels"] = parcels

# high point: inside the listed parcels if any, else the centre cell
if parcel_feats:
    mask = rasterize(parcel_feats); rr, cc = np.where(mask); zs = detail[mask]
    i = int(zs.argmax()); r0, c0 = int(rr[i]), int(cc[i]); zmin, zmax = float(zs.min()), float(zs.max())
    acres_gis = float(mask.sum() * mppx * mppy / 4046.86)
else:
    r0, c0 = map(int, to_rc(lon0, lat0)); r0 = round(r0); c0 = round(c0); zmin = zmax = float(detail[r0, c0]); acres_gis = 0
lat_h = N - (r0 + 0.5) * (N - S) / n; lon_h = W + (c0 + 0.5) * (E - W) / n
out["high"] = dict(lat=lat_h, lon=lon_h, z=rnd(detail[r0, c0]), x=rnd((c0 + 0.5) * mppx), y=rnd((n - r0 - 0.5) * mppy), r=r0, c=c0)
acres = args.acres or (sum(f["attributes"]["gisacres"] for f in parcel_feats) if parcel_feats else 0)
out["meta"] = dict(title=args.title, subtitle=args.subtitle, acres=acres, nListed=len(parcel_feats), zmin=rnd(zmin), zmax=rnd(zmax),
                   tileMin=rnd(detail.min()), tileMax=rnd(detail.max()))
log(f"high point {lat_h:.5f},{lon_h:.5f} {detail[r0,c0]:.0f} m; parcel range {zmin:.0f}-{zmax:.0f} m; gis acres {acres_gis:.2f}")

# local summit within 700 m that is higher than the property high point
Rr = int(700 / mppy); rs_ = slice(max(0, r0 - Rr), min(n, r0 + Rr + 1)); cs_ = slice(max(0, c0 - Rr), min(n, c0 + Rr + 1))
sub = detail[rs_, cs_]; sr, sc = np.unravel_index(int(sub.argmax()), sub.shape); sr += rs_.start; sc += cs_.start
if detail[sr, sc] > detail[r0, c0] + 3:
    inside_listed = bool(parcel_feats) and bool(rasterize(parcel_feats)[sr, sc])
    inside_other = bool(other_feats) and bool(rasterize(other_feats)[sr, sc])
    out["summit"] = dict(r=int(sr), c=int(sc), z=rnd(detail[sr, sc]), x=rnd((sc + 0.5) * mppx), y=rnd((n - sr - 0.5) * mppy),
                         dist=rnd(math.hypot((sc - c0) * mppx, (sr - r0) * mppy)),
                         where="listed" if inside_listed else ("owner" if inside_other else "off"),
                         bearing=rnd((math.degrees(math.atan2((sc - c0) * mppx, (r0 - sr) * mppy)) + 360) % 360, 0))
    log("summit", out["summit"])

# ---------------------------------------------------------------- USFS ownership
log("fetching Forest Service ownership…")
d = fetch_json("https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_BasicOwnership_02/MapServer/0/query", P("usfs.json"),
               {"geometry": f"{W},{S},{E},{N}", "geometryType": "esriGeometryEnvelope", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects",
                "outFields": "*", "outSR": "4326", "geometryPrecision": "5", "f": "json"}, timeout=300)
if d and d.get("features"):
    acc = np.zeros((n, n), dtype=bool); nr = 0
    for f in d["features"]:
        if f["attributes"].get("ownerclassification") != "USDA FOREST SERVICE": continue
        for ring in f["geometry"]["rings"]:
            xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
            if max(xs) < W or min(xs) > E or max(ys) < S or min(ys) > N: continue
            im = Image.new("L", (n, n), 0)
            ImageDraw.Draw(im).polygon([(c + 0.5, r + 0.5) for r, c in (to_rc(lon, lat) for lon, lat in ring)], fill=255)
            acc ^= (np.array(im) > 0); nr += 1
    if acc.any(): out["usfs"] = dict(b64=pack_mask(acc))
    log(f"  usfs: {nr} rings, {acc.mean()*100:.0f}% of tile")
else: log("  usfs: none / unavailable")

# ---------------------------------------------------------------- OpenStreetMap
log("fetching OpenStreetMap context…")
bb = f"({S:.4f},{W:.4f},{N:.4f},{E:.4f})"; bbw = f"({WS:.3f},{WW:.3f},{WN:.3f},{WE:.3f})"
small = f"({lat0-0.03:.4f},{lon0-0.035:.4f},{lat0+0.03:.4f},{lon0+0.035:.4f})"
peaks_raw = overpass(f'node["natural"="peak"]["name"]{bbw};out;', P("osm_peaks.json"))
nodes_raw = overpass(f'(node["place"~"^(town|village|hamlet|locality)$"]{bb};node["natural"="peak"]{bb};);out;', P("osm_nodes.json"))
roads_raw = overpass(f'way["highway"~"^(primary|secondary|tertiary|unclassified)$"]{bb};out geom;', P("osm_roads.json"))
resid_raw = overpass(f'way["highway"~"^(residential|living_street|track|service)$"]{small};out geom;', P("osm_resid.json"), 120)
rivers_raw = overpass(f'way["waterway"~"^(river|stream)$"]["name"]{bb};out geom;', P("osm_rivers.json"))
water_raw = overpass(f'(way["natural"="water"]["name"]{bb};relation["natural"="water"]["name"]{bb};);out bb;', P("osm_water.json"))
towns_raw = overpass(f'node["place"~"^(town|city)$"]{bbw};out;', P("osm_towns.json"))
log(f"  peaks {len(peaks_raw)} nodes {len(nodes_raw)} roads {len(roads_raw)} local {len(resid_raw)} rivers {len(rivers_raw)} water {len(water_raw)} towns {len(towns_raw)}")

def simplify(pts, tol=3.0):
    if len(pts) < 3: return pts
    keep = [pts[0]]
    for p in pts[1:-1]:
        if math.hypot(p[0] - keep[-1][0], p[1] - keep[-1][1]) >= tol: keep.append(p)
    keep.append(pts[-1]); return keep
def way_pts(e): return simplify([to_xy(g["lon"], g["lat"]) for g in e.get("geometry", []) if g])

out["roads"] = [dict(name=e.get("tags", {}).get("name"), cls=e["tags"].get("highway"), pts=[[rnd(x), rnd(y)] for x, y in way_pts(e)])
                for e in roads_raw + resid_raw if e["type"] == "way" and len(e.get("geometry", [])) >= 2]
out["rivers"] = [dict(name=e.get("tags", {}).get("name"), pts=[[rnd(x), rnd(y)] for x, y in way_pts(e)])
                 for e in rivers_raw if e["type"] == "way" and len(e.get("geometry", [])) >= 2]
places = []
for e in nodes_raw:
    t = e.get("tags", {})
    if not t.get("name") or "lon" not in e: continue
    x, y = to_xy(e["lon"], e["lat"]); ele = None
    try: ele = float(str(t.get("ele", "")).replace("m", "").split(";")[0])
    except Exception: pass
    places.append(dict(name=t["name"], kind=t.get("place") or t.get("natural"), x=rnd(x), y=rnd(y), ele=ele))
out["places"] = places

def hav(lat1, lon1, lat2, lon2):
    R = 6371000; p1, p2 = math.radians(lat1), math.radians(lat2); dl = math.radians(lon2 - lon1)
    return 2 * R * math.asin(math.sqrt(math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))
peaks = []
for e in peaks_raw:
    t = e.get("tags", {})
    try: ele = float(str(t.get("ele", "")).replace("m", "").split(";")[0])
    except Exception: continue
    if hav(lat0, lon0, e["lat"], e["lon"]) <= 120000: peaks.append(dict(n=t["name"], lat=round(e["lat"], 5), lon=round(e["lon"], 5), e=round(ele)))
out["peaks"] = peaks
towns = []
for e in towns_raw:
    t = e.get("tags", {})
    if not t.get("name"): continue
    dkm = hav(lat0, lon0, e["lat"], e["lon"]) / 1000
    pop = int(re.sub(r"\D", "", t.get("population", "0")) or 0)
    towns.append(dict(name=t["name"], lat=e["lat"], lon=e["lon"], km=rnd(dkm), pop=pop, kind=t.get("place")))
towns.sort(key=lambda t: (t["km"] > 40, -(t["pop"] > 0), t["km"]))
out["towns"] = [t for t in towns if not in_detail(t["lon"], t["lat"])][:2]
log("  nearest towns:", [(t["name"], t["km"]) for t in out["towns"]])

# ---------------------------------------------------------------- lakes from hydro-flattened DEM, named from OSM
pad = np.pad(detail, 1, mode="edge"); win = sliding_window_view(pad, (3, 3))
flat = (win.max(axis=(2, 3)) - win.min(axis=(2, 3))) < 0.03
lab = np.zeros((n, n), dtype=np.int32); comps = []
for (r, c) in zip(*np.where(flat)):
    if lab[r, c]: continue
    cid = len(comps) + 1; q = deque([(r, c)]); lab[r, c] = cid; cells = []
    while q:
        rr_, cc_ = q.popleft(); cells.append((rr_, cc_))
        for dr_, dc_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r2, c2 = rr_ + dr_, cc_ + dc_
            if 0 <= r2 < n and 0 <= c2 < n and flat[r2, c2] and not lab[r2, c2]: lab[r2, c2] = cid; q.append((r2, c2))
    comps.append(cells)
watermask = np.zeros((n, n), dtype=bool); lakes = []
# named water bodies from OSM: match by bounding box first (a reservoir's centre point can sit outside the
# tile), then by distance to the centre; each name is used once, on the largest matching surface
named = []
for e in water_raw:
    t = e.get("tags", {}); b = e.get("bounds")
    c = e.get("center") or ({"lat": (b["minlat"] + b["maxlat"]) / 2, "lon": (b["minlon"] + b["maxlon"]) / 2} if b else ({"lat": e.get("lat"), "lon": e.get("lon")} if "lat" in e else None))
    if not (t.get("name") and c): continue
    brc = None
    if b:
        r1, c1 = to_rc(b["minlon"], b["maxlat"]); r2, c2 = to_rc(b["maxlon"], b["minlat"])  # top-left, bottom-right in grid space
        brc = (r1 - 15, c1 - 15, r2 + 15, c2 + 15, (r2 - r1) * (c2 - c1))
    named.append((t["name"], to_rc(c["lon"], c["lat"]), brc))
used = set()
for cid, cells in sorted(enumerate(comps, 1), key=lambda kv: -len(kv[1])):
    if len(cells) < 150: continue
    rs = np.array([c[0] for c in cells]); cs = np.array([c[1] for c in cells]); watermask[rs, cs] = True
    name = None; cr, cc0 = rs.mean(), cs.mean()
    inside = [(brc[4], nm) for nm, _, brc in named if nm not in used and brc and brc[0] <= cr <= brc[2] and brc[1] <= cc0 <= brc[3]]
    if inside: name = min(inside)[1]  # the most specific (smallest) bounding box that contains the surface
    if name is None:  # nearest named centre, tolerance grows with the size of the surface
        best = None; tol = max(400, 2 * math.sqrt(len(cells) * mppx * mppy))
        for nm, (r, c), _ in named:
            if nm in used: continue
            dmin = float(np.min(np.hypot((rs - r) * mppy, (cs - c) * mppx)))
            if dmin < tol and (best is None or dmin < best[0]): best = (dmin, nm)
        if best: name = best[1]
    if name: used.add(name)
    lakes.append(dict(name=name, z=rnd(detail[rs[0], cs[0]]), cells=len(cells), x=rnd((cs.mean() + 0.5) * mppx), y=rnd((n - rs.mean() - 0.5) * mppy)))
out["lakes"] = lakes
out["water"] = dict(b64=pack_mask(watermask))
log("  lakes:", [(l["name"], l["z"], l["cells"]) for l in lakes])

# ---------------------------------------------------------------- assemble page
data_js = "window.RIDGE_DATA=" + json.dumps(out, separators=(",", ":")) + ";"
tpl = open(args.template, encoding="utf-8").read()
def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;")
html = tpl.replace("{{TITLE}}", esc(args.title)).replace("{{SUBTITLE}}", esc(args.subtitle)).replace("<script>/*__DATA__*/</script>", "<script>" + data_js + "</script>")
parts = re.split(r"(<script\b[^>]*>.*?</script>)", html, flags=re.S); pieces = []
for part in parts:
    if part.startswith("<script"):
        m = re.match(r"(<script\b[^>]*>)(.*)(</script>)", part, flags=re.S)
        pieces.append(m.group(1) + "".join(ch if ord(ch) < 128 else "\\u%04x" % ord(ch) for ch in m.group(2)) + m.group(3))
    else:
        pieces.append("".join(ch if ord(ch) < 128 else "&#%d;" % ord(ch) for ch in part))
final = "".join(pieces)
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
open(args.out, "w").write(final)
log(f"wrote {args.out} ({len(final)/1e6:.2f} MB)")

# ---------------------------------------------------------------- quick skyline summary (same maths as the page)
C = (1 - 0.13) / (2 * 6371000)
def bil(a, size, r, c):
    r = min(max(r, 0), size - 1.0001); c = min(max(c, 0), size - 1.0001); r0_, c0_ = int(r), int(c); fr, fc = r - r0_, c - c0_
    return a[r0_, c0_] * (1 - fr) * (1 - fc) + a[r0_, c0_ + 1] * (1 - fr) * fc + a[r0_ + 1, c0_] * fr * (1 - fc) + a[r0_ + 1, c0_ + 1] * fr * fc
tx0, ty0 = (c0 + 0.5) * mppx, (n - r0 - 0.5) * mppy; z0 = float(detail[r0, c0]) + 3.048
mLat = 1 / 111320; mLon = 1 / (111320 * cosl); rows = []
for a in range(0, 360, 10):
    th = math.radians(a); s_, co = math.sin(th), math.cos(th); mt, md, d = -1e9, 0, 6
    while d < Wm:
        x, y = tx0 + s_ * d, ty0 + co * d
        if x < 0 or y < 0 or x >= Wm or y >= Hm: break
        z = bil(detail, n, n - y / mppy - 0.5, x / mppx - 0.5) - d * d * C; t = (z - z0) / d
        if t > mt: mt, md = t, d
        d += 6
    while d < 120000:
        la, lo = lat0 + co * d * mLat, lon0 + s_ * d * mLon; r = (WN - la) / (WN - WS) * n - 0.5; c = (lo - WW) / (WE - WW) * n - 0.5
        if r < 0 or c < 0 or r >= n - 1 or c >= n - 1: break
        z = bil(wide, n, r, c) - d * d * C; t = (z - z0) / d
        if t > mt: mt, md = t, d
        d += 60
    rows.append((a, math.degrees(math.atan(mt)), md / 1609.344))
log("skyline from high point (az, deg above eye level, miles):")
for a, deg, mi in rows: log(f"  {a:3d}  {deg:5.1f}  {mi:5.1f}")
