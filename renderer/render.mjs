import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {selectComposition, renderMedia} from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
const output = process.argv[3] || path.join(here, 'out', 'luna-preview.mp4');
if (!input) throw new Error('Usage: node render.mjs <production-pack.json> [output.mp4]');
const pack = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
const shots = Array.isArray(pack.shots) ? pack.shots : [];
if (!shots.length) throw new Error('No structured shots found. Export a production pack with recognized SHOT/SCENE entries first.');
const serveUrl = await bundle({entryPoint: path.join(here, 'src', 'index.jsx')});
const inputProps = {episode: pack.episode || {}, shots, targetFormat: '9:16'};
const composition = await selectComposition({serveUrl, id: 'LunaEpisode', inputProps});
fs.mkdirSync(path.dirname(path.resolve(output)), {recursive: true});
await renderMedia({composition, serveUrl, codec: 'h264', outputLocation: path.resolve(output), inputProps});
console.log(`Rendered ${shots.length} scenes to ${path.resolve(output)}`);
