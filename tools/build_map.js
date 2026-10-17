// Builds data/world.json: a light world map keyed by ISO 3166-1 alpha-2 codes,
// drawn to follow the conventions of United Nations maps:
//   - Crimea shown as part of Ukraine, the Golan as part of the Syrian Arab Republic,
//     Western Sahara as a separate territory, Somaliland within Somalia and
//     northern Cyprus within Cyprus.
//   - Areas whose status is not determined (Jammu and Kashmir, Aksai Chin,
//     Arunachal Pradesh, the Abyei area and the Hala'ib Triangle) drawn as their own
//     shapes, with ids starting "_", so the page can grey them out and draw their
//     boundaries as dashed lines (and the Line of Control as a dotted line).
// Small countries also get a point so they can still be seen and tapped.
//
// One-off script. The map rarely changes, so it is not part of the monthly refresh.
//   npm install
//   node tools/build_map.js ne_50m_admin_0_breakaway_disputed_areas.geojson ne_10m_admin_0_disputed_areas.geojson
// The two Natural Earth files are in the geojson folder of
// https://github.com/nvkelso/natural-earth-vector
"use strict";
const fs = require("fs");
const path = require("path");
const topojson = require("topojson-client");
const { topology } = require("topojson-server");
const simplify = require("topojson-simplify");
const d3 = require("d3-geo");
const pc = require("polygon-clipping");
const countries = require("i18n-iso-countries");

const [NE50, NE10] = process.argv.slice(2);
if (!NE50 || !NE10) {
  console.error("Usage: node tools/build_map.js <ne_50m_admin_0_breakaway_disputed_areas.geojson> <ne_10m_admin_0_disputed_areas.geojson>");
  process.exit(1);
}

const SRC = require.resolve("world-atlas/countries-50m.json");
const OUT = path.join(__dirname, "..", "data", "world.json");
const KEEP = 0.08;   // share of map points kept after simplification
const SMALL = 5e-5;  // steradians (about 2,000 km2): below this a country also gets a point
const SLIVER = 2e-4; // square degrees (about 2 km2): clipped pieces smaller than this are dropped

const BY_NAME = { "Kosovo": "XK", "Somaliland": "SO", "N. Cyprus": "CY", "Siachen Glacier": "_JKI" };
const DROP = new Set(["010"]); // Antarctica
const EXTRA_POINTS = { TV: [179.19, -8.52] };
const NAMES = {
  _JKI: "Jammu and Kashmir", _JKP: "Jammu and Kashmir", _AC: "Aksai Chin", _AP: "Arunachal Pradesh",
  _AB: "Abyei area", _HT: "Hala'ib Triangle", EH: "Western Sahara", FK: "Falkland Islands (Malvinas)",
};

/* ---------- geometry helpers ---------- */
const asMulti = (g) => (!g ? [] : g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
function ringArea(ring) {
  let s = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return s / 2;
}
// d3-geo wants exterior rings clockwise and holes anticlockwise (in lon/lat terms).
function rewind(multi) {
  return multi.map((poly) => poly.map((ring, i) => {
    const a = ringArea(ring);
    return (i === 0 ? a > 0 : a < 0) ? ring.slice().reverse() : ring;
  }));
}
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function neFeature(file, name) {
  const fc = JSON.parse(fs.readFileSync(file, "utf8"));
  const f = fc.features.find((x) => x.properties.BRK_NAME === name || x.properties.NAME === name);
  if (!f) throw new Error(`"${name}" not found in ${file}`);
  return asMulti(f.geometry);
}

/* ---------- 1. countries from the base map, merged by code ---------- */
const topo = JSON.parse(fs.readFileSync(SRC, "utf8"));
const groups = new Map();
for (const g of topo.objects.countries.geometries) {
  if (g.id && DROP.has(g.id)) continue;
  const name = g.properties && g.properties.name;
  const key = BY_NAME[name] || (g.id ? countries.numericToAlpha2(g.id) : null) || "~" + name;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(g);
}
const shapes = new Map(); // code -> MultiPolygon coordinates
const clipped = new Set(); // shapes produced by polygon clipping, which need rewinding for d3
for (const [key, list] of groups) shapes.set(key, asMulti(topojson.merge(topo, list)));

/* ---------- 2. UN map conventions ---------- */
function carve(from, area, to) {
  // Move the part of `from` that lies inside `area` into `to`.
  const part = pc.intersection(shapes.get(from), area);
  if (!part.length) throw new Error(`nothing to carve from ${from} into ${to}`);
  shapes.set(from, pc.difference(shapes.get(from), area));
  shapes.set(to, shapes.has(to) ? pc.union(shapes.get(to), part) : part);
  clipped.add(from).add(to);
  // The two sources draw some shared borders slightly differently, which leaves thin
  // strips of `from` along the edge of the carved area. Hand those strips over too.
  const xs = area.flat(2).map((p) => p[0]), ys = area.flat(2).map((p) => p[1]);
  const box = [Math.min(...xs) - 0.1, Math.min(...ys) - 0.1, Math.max(...xs) + 0.1, Math.max(...ys) + 0.1];
  const keep = [], strips = [];
  for (const poly of shapes.get(from)) {
    const ring = poly[0];
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const small = Math.abs(ringArea(ring)) < 0.05;
    (small && cx > box[0] && cx < box[2] && cy > box[1] && cy < box[3] ? strips : keep).push(poly);
  }
  if (strips.length) {
    shapes.set(from, keep);
    shapes.set(to, pc.union(shapes.get(to), strips));
  }
}

// Crimea: the Crimean polygon of the Russian Federation moves to Ukraine.
{
  const ru = shapes.get("RU");
  const i = ru.findIndex((poly) => inRing([34.1, 45.0], poly[0]));
  if (i < 0) throw new Error("Crimea polygon not found");
  const crimea = ru[i];
  shapes.set("RU", ru.filter((_, k) => k !== i));
  shapes.set("UA", pc.union(shapes.get("UA"), [crimea]));
  clipped.add("UA");
}
carve("IL", neFeature(NE50, "Golan Heights"), "SY");
carve("MA", neFeature(NE50, "W. Sahara"), "EH");
carve("SD", neFeature(NE50, "Abyei"), "_AB");
carve("EG", neFeature(NE10, "Halayib Triangle"), "_HT");
carve("CN", neFeature(NE50, "Aksai Chin"), "_AC");
carve("IN", neFeature(NE50, "Arunachal Pradesh"), "_AP");
carve("IN", neFeature(NE50, "Jammu and Kashmir"), "_JKI");
carve("PK", neFeature(NE50, "Gilgit-Baltistan"), "_JKP");
carve("PK", neFeature(NE10, "Azad Kashmir"), "_JKP");

/* ---------- 3. one topology, simplified ---------- */
const features = [];
const centroids = {};
for (const [key, multi] of shapes) {
  if (!multi.length) continue;
  // Clipping leaves hairline slivers where two sources disagree slightly; drop them.
  const cleaned = clipped.has(key) ? rewind(multi.filter((poly) => Math.abs(ringArea(poly[0])) > SLIVER)) : multi;
  const geometry = { type: "MultiPolygon", coordinates: cleaned };
  const f = { type: "Feature", geometry, properties: {} };
  const area = d3.geoArea(f);
  if (!(area > 0 && area < 2 * Math.PI)) throw new Error(`bad winding for ${key}: ${area}`);
  centroids[key] = { c: d3.geoCentroid(f), area };
  if (key.startsWith("~")) f.properties.n = key.slice(1);
  else {
    f.id = key;
    const name = NAMES[key] || (key.startsWith("_") ? null : countries.getName(key, "en", { select: "alias" }));
    if (name) f.properties.n = name;
  }
  features.push(f);
}

const full = topology({ countries: { type: "FeatureCollection", features } }, 1e6);
const pre = simplify.presimplify(full);
const simple = simplify.simplify(pre, simplify.quantile(pre, KEEP));
const out = topojson.quantize(simple, 1e4);

// Simplification can collapse a tiny polygon into a ring that d3 reads inside out.
// Drop any such polygon, then drop shapes left with nothing.
for (const g of out.objects.countries.geometries) {
  if (g.type !== "MultiPolygon") continue;
  g.arcs = g.arcs.filter((poly) => {
    const a = d3.geoArea(topojson.feature(out, { type: "Polygon", arcs: poly }));
    return a > 0 && a < 2 * Math.PI;
  });
}
const points = { ...EXTRA_POINTS };
out.objects.countries.geometries = out.objects.countries.geometries.filter((g) => {
  if (g.type === "MultiPolygon" && !g.arcs.length) {
    const original = g.id && centroids[g.id];
    if (original && !g.id.startsWith("_")) points[g.id] = original.c.map((v) => Math.round(v * 100) / 100);
    return false;
  }
  const area = d3.geoArea(topojson.feature(out, g));
  const keep = area > 0 && area < 2 * Math.PI;
  const original = g.id && centroids[g.id];
  if (original && !g.id.startsWith("_") && (!keep || original.area < SMALL)) {
    points[g.id] = original.c.map((v) => Math.round(v * 100) / 100);
  }
  return keep;
});
out.points = points;
delete out.bbox;

fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${OUT}: ${out.objects.countries.geometries.length} shapes, ${Object.keys(points).length} points, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
