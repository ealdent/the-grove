# terrain-map

Builds a self-contained 3D contour map for a US land listing: USGS elevation, the parcel
outline, National Forest ownership, roads and peaks, a click-to-move viewshed and a 360°
skyline. Output is one HTML file (about 4 MB) that goes in `utils/contours/`, which has its own
unlisted `index.html`; nothing else on the site links there.

Requires `python3` with `numpy` and `pillow`, plus `curl`. No API keys.

## Usage

```bash
python3 scripts/terrain-map/make_terrain_map.py \
  --slug gentle-ponds-view \
  --title "57 Gentle Ponds View" \
  --subtitle "7.51 acres in five lots · Wilderness Creek Falls, Murphy, NC" \
  --parcels 451000052387000,451000051649000,451000053637000,451000053888000,451000053171000 \
  --county Cherokee --acres 7.51 \
  --out utils/contours/gentle-ponds-view.html
```

`--parcels` takes county parcel numbers (`parno`). The page centres on their combined
footprint; pass `--lat/--lon` instead for a bare point with no parcel outline.
Downloads are cached in `--workdir` (default `$TMPDIR/terrain-<slug>`), so a rerun after
a flaky OpenStreetMap response takes under a minute.

Finding parcel numbers for a North Carolina listing (statewide NC OneMap layer):

```bash
curl -s -G "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query" \
  --data-urlencode "where=cntyname='Cherokee' AND siteadd LIKE '%GENTLE POND%'" \
  --data-urlencode "outFields=parno,siteadd,gisacres,ownname" --data-urlencode "returnGeometry=false" \
  --data-urlencode "f=json"
```

Listing pages usually carry the primary parcel number in their HTML (`parcelNumber`,
`pid`); a query on the owner name then turns up the other lots in a multi-lot sale.
Zillow blocks scripted fetches outright; geocode the street address with the Census
geocoder instead and query the parcel layer with a small envelope around that point.

Tennessee uses `--state tn` and the statewide "Tennessee Property Boundaries Public Use"
feature service. Its `ADDRESS` field is written street-first (`CULBERSON LN 674`), parcel
ids contain runs of spaces (`046 064    02400 000 2026`, quote them), and county names are
title case (`Johnson`):

```bash
python3 scripts/terrain-map/make_terrain_map.py --slug culberson-lane --state tn --county Johnson \
  --parcels "046 064    02400 000 2026,046 064    02500 000 2026" --acres 9.04 \
  --title "674 Culberson Lane" --subtitle "..." --out utils/contours/culberson-lane.html
```

Georgia counties (Gilmer, for one) publish parcels only through qPublic and paid vendors, so
there is no `--state ga`. Build from the geocoded address instead; the page then marks an
address point rather than a boundary and says so in its key:

```bash
python3 scripts/terrain-map/make_terrain_map.py --slug stone-road --county none --owner-tracts none \
  --lat 34.658571 --lon -84.479264 --title "472 Stone Road" --subtitle "..." --out utils/contours/stone-road.html
```

## Data sources

- Elevation: USGS 3DEP `exportImage` (bare earth, whole US). Two grids: ~12 m over 14.5 km
  for the map and viewshed, ~140 m over 167 km for the far skyline.
- Parcels: NC OneMap for North Carolina, the Tennessee Property Boundaries Public Use layer for
  Tennessee; add other states to `PARCEL_SERVICES`. Georgia has no public source.
- Forest ownership: USDA Forest Service EDW basic ownership layer.
- Roads, rivers, peaks, places, lake names: OpenStreetMap via Overpass. Optional; the
  map still builds without them. Lakes themselves come from flat cells in the DEM.

## Caveats

- The elevation model has no trees or buildings. Wooded land "sees" more in the model
  than in life; the page says so and exposes an eye-height slider.
- Sightlines include earth curvature and standard refraction (k = 0.13).
- The Overpass mirrors rate-limit and time out; the script retries both and moves on.

## The contours index

`utils/contours/index.html` is an orbital view of the Southern Appalachians: the USGS elevation
grid bent onto an exaggerated sphere, seen obliquely with atmosphere and stars above, run through a
CRT-style post-process, with one floating tag per property. Scroll or swipe changes altitude. It is
built by `contours-index/build_index.py` from the same USGS elevation service, USGS
National Hydrography lakes and a generalized US-states outline. To add a property, append it to
`PROPS` in that script (name, town, coordinates, size, price, the two headline numbers from its
map page) and rerun:

```bash
python3 scripts/terrain-map/contours-index/build_index.py
```

Downloads cache in `$TMPDIR/contours-index`, so a rebuild takes a few seconds.
