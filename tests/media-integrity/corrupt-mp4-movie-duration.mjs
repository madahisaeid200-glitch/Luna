#!/usr/bin/env node
// Corrupt only the MP4 movie-header duration; encoded packets and track timing stay unchanged.
import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node corrupt-mp4-movie-duration.mjs <fixture.mp4>');
  process.exit(2);
}
const data = fs.readFileSync(file);

function boxes(buffer, start, end) {
  const found = [];
  let cursor = start;
  while (cursor + 8 <= end) {
    const size32 = buffer.readUInt32BE(cursor);
    const type = buffer.toString('ascii', cursor + 4, cursor + 8);
    let size = size32;
    let headerSize = 8;
    if (size32 === 1) {
      if (cursor + 16 > end) throw new Error('Truncated extended MP4 atom header');
      const extended = buffer.readBigUInt64BE(cursor + 8);
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('MP4 atom is too large');
      size = Number(extended);
      headerSize = 16;
    } else if (size32 === 0) {
      size = end - cursor;
    }
    if (size < headerSize || cursor + size > end) throw new Error('Invalid MP4 atom bounds: ' + type);
    found.push({type, payload: cursor + headerSize, end: cursor + size});
    cursor += size;
  }
  if (cursor !== end) throw new Error('MP4 atom table has trailing bytes');
  return found;
}

const moov = boxes(data, 0, data.length).find(atom => atom.type === 'moov');
if (!moov) throw new Error('MP4 moov atom not found');
const mvhd = boxes(data, moov.payload, moov.end).find(atom => atom.type === 'mvhd');
if (!mvhd) throw new Error('MP4 mvhd atom not found');
const version = data[mvhd.payload];
let timescale;
let durationOffset;
if (version === 0) {
  timescale = data.readUInt32BE(mvhd.payload + 12);
  durationOffset = mvhd.payload + 16;
  if (durationOffset + 4 > mvhd.end) throw new Error('Truncated version-0 mvhd duration');
} else if (version === 1) {
  timescale = data.readUInt32BE(mvhd.payload + 20);
  durationOffset = mvhd.payload + 24;
  if (durationOffset + 8 > mvhd.end) throw new Error('Truncated version-1 mvhd duration');
} else {
  throw new Error('Unsupported mvhd version: ' + version);
}
if (!timescale) throw new Error('Invalid MP4 movie timescale');
const nineSeconds = BigInt(timescale) * 9n;
if (version === 0) {
  if (nineSeconds > 0xffffffffn) throw new Error('Nine-second duration does not fit version-0 mvhd');
  data.writeUInt32BE(Number(nineSeconds), durationOffset);
} else {
  data.writeBigUInt64BE(nineSeconds, durationOffset);
}
fs.writeFileSync(file, data);
console.log('Created MP4 mvhd duration mismatch fixture (9 seconds); encoded packets and track headers are unchanged.');
