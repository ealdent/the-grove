#!/usr/bin/env python3
"""Build utils/contours/index.html: a WebGL relief map of the Southern Appalachians with one pin per
property. To add a property, append to PROPS below and rerun:

  python3 scripts/terrain-map/contours-index/build_index.py

Data (cached in --workdir, default $TMPDIR/contours-index): USGS 3DEP elevation for the region,
USGS National Hydrography waterbodies over 2 km2, and a generalized US-states GeoJSON for borders.
"""
import argparse, base64, gzip, json, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
W, S, E, N = -86.20, 33.55, -81.00, 37.15     # region shown (wide enough that the camera's foreground is real terrain)
TW, TH = 1700, 1440                             # elevation grid, about 275 m per cell

# name, town, lat, lon, size, price, ground in view (mi2), horizon (mi), horizon direction, label anchor
PROPS = [
    dict(slug="top-horseshoe-ridge", name="Top Horseshoe Ridge", town="Unaka, NC", lat=35.18617, lon=-84.13633, size="23 ac", price="$175k", view="6.3", sky="11", dir="NE", anchor="ne"),
    dict(slug="gentle-ponds-view", name="57 Gentle Ponds View", town="Murphy, NC", lat=35.02196, lon=-84.31235, size="7.5 ac · 5 lots", price="$899k", view="1.9", sky="25", dir="SE", anchor="sw"),
    dict(slug="culberson-lane", name="674 Culberson Lane", town="Mountain City, TN", lat=36.41266, lon=-81.76109, size="9 ac · 2 lots", price="$396k", view="2.1", sky="9", dir="WNW", anchor="w"),
    dict(slug="jacks-creek-road", name="6334 Jacks Creek Road", town="Burnsville, NC", lat=35.97449, lon=-82.30128, size="17.7 ac", price="$799k", view="5.6", sky="15", dir="ENE", anchor="e"),
    dict(slug="stone-road", name="472 Stone Road", town="Ellijay, GA", lat=34.65857, lon=-84.47926, size="lot size n/a", price="$400k", view="0.1", sky="1", dir="SE", anchor="s"),
]

# name, lat, lon, kind (city | peak | lake | state), priority (1 always, 2 medium zoom, 3 close zoom)
PLACES = [
    ("Asheville", 35.5951, -82.5515, "city", 1), ("Knoxville", 35.9606, -83.9207, "city", 1), ("Chattanooga", 35.0456, -85.3097, "city", 1),
    ("Greenville", 34.8526, -82.3940, "city", 2), ("Johnson City", 36.3134, -82.3535, "city", 2), ("Boone", 36.2168, -81.6746, "city", 2),
    ("Gatlinburg", 35.7143, -83.5102, "city", 2), ("Murphy", 35.0876, -84.0349, "city", 2), ("Ellijay", 34.6948, -84.4822, "city", 2),
    ("Burnsville", 35.9173, -82.3007, "city", 3), ("Mountain City", 36.4745, -81.8046, "city", 3), ("Blue Ridge", 34.8640, -84.3240, "city", 3),
    ("Dahlonega", 34.5326, -83.9849, "city", 3), ("Franklin", 35.1823, -83.3815, "city", 3), ("Bryson City", 35.4315, -83.4485, "city", 3),
    ("Hiawassee", 34.9493, -83.7574, "city", 3), ("Cleveland", 35.1595, -84.8766, "city", 3), ("Maryville", 35.7565, -83.9705, "city", 3),
    ("Mount Mitchell", 35.7650, -82.2652, "peak", 1), ("Kuwohi", 35.5629, -83.4985, "peak", 1), ("Brasstown Bald", 34.8740, -83.8107, "peak", 2),
    ("Roan High Knob", 36.1046, -82.1223, "peak", 2), ("Grandfather Mountain", 36.0969, -81.8320, "peak", 2), ("Mount Rogers", 36.6598, -81.5448, "peak", 3),
    ("Springer Mountain", 34.6269, -84.1939, "peak", 3), ("Big Frog Mountain", 35.0117, -84.4967, "peak", 3),
    ("Fontana Lake", 35.4300, -83.7500, "lake", 2), ("Lake Chatuge", 34.9800, -83.7800, "lake", 3), ("Hiwassee Lake", 35.1500, -84.1300, "lake", 3),
    ("Watauga Lake", 36.3100, -82.0800, "lake", 3), ("Douglas Lake", 35.9700, -83.3500, "lake", 3), ("Norris Lake", 36.2200, -84.0000, "lake", 3),
    ("TENNESSEE", 36.05, -84.55, "state", 1), ("NORTH CAROLINA", 35.60, -82.95, "state", 1), ("GEORGIA", 34.42, -83.75, "state", 1),
    ("SOUTH CAROLINA", 34.55, -82.35, "state", 2), ("VIRGINIA", 36.82, -82.45, "state", 2),
]

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--out", default=os.path.join(REPO, "utils", "contours", "index.html"))
ap.add_argument("--workdir", default=os.path.join(os.environ.get("TMPDIR", "/tmp"), "contours-index-v2"))
ap.add_argument("--template", default=os.path.join(HERE, "index_template.html"))
args = ap.parse_args()
os.makedirs(args.workdir, exist_ok=True)
P = lambda n: os.path.join(args.workdir, n)
def log(*a): print(*a, file=sys.stderr, flush=True)

def fetch(url, out, data=None, timeout=600):
    if os.path.exists(out) and os.path.getsize(out) > 500: return out
    cmd = ["curl", "-sL", "-m", str(timeout), "-o", out, "-w", "%{http_code}", url]
    if data:
        for k, v in data.items(): cmd += ["--data-urlencode", f"{k}={v}"]
    code = subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
    if code != "200": raise SystemExit(f"fetch failed ({code}): {url}")
    return out

# elevation
fetch("https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
      f"?bbox={W},{S},{E},{N}&bboxSR=4326&imageSR=4326&size={TW},{TH}&format=tiff&pixelType=F32"
      "&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_BilinearInterpolation&f=image", P("region_dem.tif"))
a = np.array(Image.open(P("region_dem.tif")), dtype=np.float32)
a = np.nan_to_num(a, nan=float(np.nanmin(a)))
q = np.round(a).astype(np.int16)
d = np.diff(q, axis=1, prepend=np.zeros((TH, 1), dtype=np.int16)).astype(np.int16)
dem_b64 = base64.b64encode(gzip.compress(d.tobytes(), 9)).decode()
log(f"elevation {a.min():.0f}-{a.max():.0f} m")

def to_px(lon, lat): return ((lon - W) / (E - W) * TW, (N - lat) / (N - S) * TH)

# lakes: NHD waterbodies (large scale), even-odd fill of every ring that touches the region
fetch("https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query", P("nhd_waterbodies.json"),
      {"where": "areasqkm > 2", "geometry": f"{W},{S},{E},{N}", "geometryType": "esriGeometryEnvelope", "inSR": "4326",
       "spatialRel": "esriSpatialRelIntersects", "outFields": "gnis_name,areasqkm", "outSR": "4326", "geometryPrecision": "4",
       "maxAllowableOffset": "0.002", "returnGeometry": "true", "f": "json"})
mask = np.zeros((TH, TW), dtype=bool); nr = 0
for f in json.load(open(P("nhd_waterbodies.json")))["features"]:
    for ring in f["geometry"]["rings"]:
        pts = [to_px(x, y) for x, y in ring]; xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        if max(xs) < 0 or min(xs) > TW or max(ys) < 0 or min(ys) > TH: continue
        im = Image.new("L", (TW, TH), 0); ImageDraw.Draw(im).polygon(pts, fill=255); mask ^= (np.array(im) > 0); nr += 1
water_b64 = base64.b64encode(gzip.compress(np.packbits(mask.ravel()).tobytes(), 9)).decode()
log(f"water: {nr} rings, {mask.sum()*(E-W)/TW*111.32*math.cos(math.radians((N+S)/2))*(N-S)/TH*111.32:.0f} km2")

# state borders: generalized US states GeoJSON, clipped to the region plus a margin
fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json", P("us-states.json"))
states = []; pad_ = 0.5
for f in json.load(open(P("us-states.json")))["features"]:
    g = f["geometry"]; polys = g["coordinates"] if g["type"] == "Polygon" else [p for mp in g["coordinates"] for p in mp]
    lines = []
    for ring in polys:
        run = []
        for i, (x, y) in enumerate(ring):
            inside = (W - pad_) <= x <= (E + pad_) and (S - pad_) <= y <= (N + pad_)
            if inside:
                if not run and i > 0: run.append([round(ring[i-1][0], 3), round(ring[i-1][1], 3)])
                run.append([round(x, 3), round(y, 3)])
            elif run: run.append([round(x, 3), round(y, 3)]); lines.append(run); run = []
        if len(run) > 1: lines.append(run)
    lines = [l for l in lines if len(l) > 1]
    if lines: states.append(dict(name=f["properties"]["name"], lines=lines))
log("states:", [s["name"] for s in states])

data = dict(bbox=dict(W=W, S=S, E=E, N=N), w=TW, h=TH, zmin=float(max(0.0, np.percentile(a, 0.5))), zmax=float(a.max()),
            mpp=[(E - W) / TW * 111320 * math.cos(math.radians((N + S) / 2)), (N - S) / TH * 111320],
            dem=dem_b64, water=water_b64, states=states,
            places=[dict(n=p[0], lat=p[1], lon=p[2], k=p[3], p=p[4]) for p in PLACES], props=PROPS)
tpl = open(args.template, encoding="utf-8").read()
html = tpl.replace("<script>/*__DATA__*/</script>", "<script>window.REGION=" + json.dumps(data, separators=(",", ":")) + ";</script>")
parts = re.split(r"(<script\b[^>]*>.*?</script>)", html, flags=re.S); pieces = []
for part in parts:  # keep the file ASCII so it survives any server's charset handling
    if part.startswith("<script"):
        m = re.match(r"(<script\b[^>]*>)(.*)(</script>)", part, flags=re.S)
        pieces.append(m.group(1) + "".join(ch if ord(ch) < 128 else "\\u%04x" % ord(ch) for ch in m.group(2)) + m.group(3))
    else:
        pieces.append("".join(ch if ord(ch) < 128 else "&#%d;" % ord(ch) for ch in part))
final = "".join(pieces)
os.makedirs(os.path.dirname(args.out), exist_ok=True)
open(args.out, "w").write(final)
log(f"wrote {args.out} ({len(final)/1e6:.2f} MB)")
