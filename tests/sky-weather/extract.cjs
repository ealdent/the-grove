// Extract the two inline <script> blocks (astronomy-engine bundle + app) from
// utils/sky_weather_infographic.html into tests/sky-weather/.extracted/ as .cjs files.
// Usage: node extract.cjs [path-to-html]   (default: the working-tree file;
// the pre-commit hook passes the STAGED blob instead)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const htmlPath = process.argv[2] || path.join(ROOT, 'utils', 'sky_weather_infographic.html');
const outDir = path.join(__dirname, '.extracted');
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(htmlPath, 'utf8');

// engine block: the <script> right after the provenance comment
const ci = html.indexOf('astronomy-engine v2.1.19 (browserify UMD');
if (ci === -1) throw new Error('provenance comment not found — engine block missing?');
const bs = html.indexOf('<script>', ci) + '<script>'.length;
const be = html.indexOf('</script>', bs);
const bundle = html.slice(bs, be);

// app block: the last <script>...</script>
const as = html.indexOf('<script>', be) + '<script>'.length;
const ae = html.lastIndexOf('</script>');
const app = html.slice(as, ae);
if (!app.includes('computeAstronomy')) throw new Error('app extraction looks wrong');

fs.writeFileSync(path.join(outDir, 'engine.cjs'), bundle);
fs.writeFileSync(path.join(outDir, 'app.cjs'), app);
console.log(`extracted from ${htmlPath}: engine ${bundle.length} chars, app ${app.length} chars`);
