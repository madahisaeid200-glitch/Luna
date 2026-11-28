#!/usr/bin/env node
// Corrupt the WebM Segment Info Duration while preserving all encoded packets.
import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node corrupt-webm-container-duration.mjs <fixture.webm>');
  process.exit(2);
}
const data = fs.readFileSync(file);

function vint(position, isId = false) {
  const first = data[position];
  if (first === undefined || first === 0) throw new Error('Invalid EBML variable integer');
  let length = 1;
  let mask = 0x80;
  while (!(first & mask)) { length++; mask >>= 1; }
  if (length > 8 || position + length > data.length) throw new Error('Invalid EBML variable integer length');
  let value = isId ? first : (first & (mask - 1));
  for (let i = 1; i < length; i++) value = value * 256 + data[position + i];
  return {length, value};
}
function children(start, end) {
  const items = [];
  let cursor = start;
  while (cursor < end) {
    const id = vint(cursor, true);
    const size = vint(cursor + id.length, false);
    const payload = cursor + id.length + size.length;
    const itemEnd = payload + size.value;
    if (itemEnd > end || itemEnd <= payload) throw new Error('EBML element exceeds parent bounds');
    items.push({id:id.value, payload, size:size.value, end:itemEnd});
    cursor = itemEnd;
  }
  return items;
}

const segment = children(0, data.length).find(item => item.id === 0x18538067);
if (!segment) throw new Error('WebM Segment element not found');
const info = children(segment.payload, segment.end).find(item => item.id === 0x1549A966);
if (!info) throw new Error('WebM Segment Info element not found');
const infoChildren = children(info.payload, info.end);
const duration = infoChildren.find(item => item.id === 0x4489);
if (!duration || ![4, 8].includes(duration.size)) {
  throw new Error('WebM Segment Info Duration float not found');
}
const scaleElement = infoChildren.find(item => item.id === 0x2AD7B1);
let timecodeScale = 1000000; // Matroska default: one millisecond in nanoseconds.
if (scaleElement) {
  timecodeScale = 0;
  for (let i = 0; i < scaleElement.size; i++) {
    timecodeScale = timecodeScale * 256 + data[scaleElement.payload + i];
  }
}
if (!Number.isFinite(timecodeScale) || timecodeScale <= 0) throw new Error('Invalid WebM TimecodeScale');
const nineSecondsInTicks = 9 * 1e9 / timecodeScale;
if (duration.size === 8) data.writeDoubleBE(nineSecondsInTicks, duration.payload);
else data.writeFloatBE(nineSecondsInTicks, duration.payload);
fs.writeFileSync(file, data);
console.log('Created WebM fixture with a 9-second Segment Info duration and unchanged media packets.');
