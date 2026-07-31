import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'dist');
const sourcePath = path.join(outputRoot, 'index.source.html');
let html = await readFile(sourcePath, 'utf8');

const stylesheetMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
if (stylesheetMatch) {
  const cssPath = path.resolve(outputRoot, stylesheetMatch[1]);
  const css = await readFile(cssPath, 'utf8');
  html = html.replace(stylesheetMatch[0], () => `<style>${css}</style>`);
}

const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
if (!scriptMatch) {
  throw new Error('Could not find the generated JavaScript entry in dist/index.source.html');
}

const scriptPath = path.resolve(outputRoot, scriptMatch[1]);
const script = (await readFile(scriptPath, 'utf8')).replaceAll('</script>', '<\\/script>');
html = html.replace(scriptMatch[0], '');
html = html.replace('</body>', () => `  <script>${script}</script>\n  </body>`);

await mkdir(projectRoot, { recursive: true });
await writeFile(path.join(projectRoot, 'index.html'), html);
