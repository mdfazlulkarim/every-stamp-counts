// Builds data/world.json: a light world map keyed by ISO 3166-1 alpha-2 codes,
// plus a point for every small country so it can still be seen and tapped.
// One-off script. The map rarely changes, so it is not part of the monthly refresh.
//   npm install
//   node tools/build_map.js
"use strict";
const fs = require("fs");
const path = require("path");
const topojson = require("topojson-client");
const simplify = require("topojson-simplify");
const d3 = require("d3-geo");
const countries = require("i18n-iso-countries");

const SRC = require.resolve("world-atlas/countries-50m.json");
const OUT = path.join(__dirname, "..", "data", "world.json");
const KEEP = 0.08;        // share of map points kept after simplification
const SMALL = 5e-5;       // steradians (about 2,000 km2): below this a country also gets a point

// Features without a numeric code in Natural Earth, or drawn as part of the
// country listed here, following UN map practice.
const BY_NAME = { "Kosovo": "XK", "Somaliland": "SO", "N. Cyprus": "CY" };
const DROP = new Set(["010"]); // Antarctica
// Countries missing from the 50m map entirely.
const EXTRA_POINTS = { TV: [179.19, -8.52] };

function isoOf(g) {
  const name = g.properties && g.properties.name;
  return BY_NAME[name] || (g.id ? countries.numericToAlpha2(g.id) : null) || "~" + name;
}

function grouped(topology) {
  const groups = new Map();
  for (const g of topology.objects.countries.geometries) {
    if (g.id && DROP.has(g.id)) continue;
    const key = isoOf(g);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  return groups;
}

const topo = JSON.parse(fs.readFileSync(SRC, "utf8"));

// Centroids from the full-detail map, used for the small-country points.
const centroids = {};
for (const [key, list] of grouped(topo)) {
  const geometry = list.length === 1 ? topojson.feature(topo, list[0]).geometry : topojson.merge(topo, list);
  const geo = { type: "Feature", geometry };
  centroids[key] = { c: d3.geoCentroid(geo), area: d3.geoArea(geo) };
}

const pre = simplify.presimplify(topo);
const simple = simplify.simplify(pre, simplify.quantile(pre, KEEP));

const geometries = [];
for (const [key, list] of grouped(simple)) {
  const geom = list.length === 1 ? { ...list[0] } : topojson.mergeArcs(simple, list);
  if (!geom || !geom.type) continue;
  delete geom.properties;
  if (key.startsWith("~")) geom.properties = { n: key.slice(1) };
  else geom.id = key;
  geometries.push(geom);
}

const out = topojson.quantize({
  type: "Topology",
  bbox: simple.bbox,
  arcs: simple.arcs.map((arc) => arc.map((p) => [p[0], p[1]])),
  objects: { countries: { type: "GeometryCollection", geometries } },
}, 1e4);

// Drop shapes that collapsed to nothing, and add points for small countries.
const points = { ...EXTRA_POINTS };
out.objects.countries.geometries = out.objects.countries.geometries.filter((g) => {
  const area = d3.geoArea(topojson.feature(out, g));
  const key = g.id;
  const original = key && centroids[key];
  const keep = area > 0 && area < 2 * Math.PI;
  if (key && original && (!keep || original.area < SMALL)) {
    points[key] = original.c.map((v) => Math.round(v * 100) / 100);
  }
  return keep;
});
out.points = points;

fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${OUT}: ${out.objects.countries.geometries.length} shapes, ${Object.keys(points).length} points, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
