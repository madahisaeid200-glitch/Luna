#!/usr/bin/env node
// Deliberately corrupt only the MP4 movie-header duration while preserving
// every media packet. This creates a quota-free container/stream mismatch fixture.
import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node corrupt-mp4-container-duration.mjs <fixture.mp4>');
  process.exit(2);
}
const data = fs.readFileSync(file);
const marker = Buffer.from('mvhd');
const index = data.indexOf(marker);
if (index < 0 || index + 32 > data.length) {
  console.error('Could not locate a complete MP4 mvhd atom');
  process.exit(1);
}
const version = data[index + 4];
let timescale;
let durationOffset;
if (version === 0) {
  timescale = data.readUInt32BE(index + 16);
  durationOffset = index + 20;
} else if (version === 1) {
  timescale = data.readUInt32BE(index + 24);
  durationOffset = index + 28;
} else {
  console.error('Unsupported MP4 mvhd version: ' + version);
  process.exit(1);
}
if (!timescale) {
  console.error('MP4 movie-header timescale is invalid');
  process.exit(1);
}
const corruptDuration = BigInt(timescale) * 9n;
if (version === 0) {
  if (corruptDuration > 0xffffffffn) {
    console.error('Corrupt duration does not fit version-0 mvhd');
    process.exit(1);
  }
  data.writeUInt32BE(Number(corruptDuration), durationOffset);
} else {
  data.writeBigUInt64BE(corruptDuration, durationOffset);
}
fs.writeFileSync(file, data);
console.log('Created MP4 fixture with a 9-second container duration and unchanged media packets.');
