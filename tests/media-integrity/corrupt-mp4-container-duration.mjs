#!/usr/bin/env node
// Deliberately corrupt MP4 movie/track duration headers while preserving every
// media packet. FFprobe derives the reported format duration from track headers
// on some files, so both mvhd and each mdhd duration must be changed.
import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node corrupt-mp4-container-duration.mjs <fixture.mp4>');
  process.exit(2);
}
const data = fs.readFileSync(file);

function rewriteDurationAtoms(type) {
  const marker = Buffer.from(type);
  let offset = 0;
  let count = 0;
  while ((offset = data.indexOf(marker, offset)) >= 0) {
    const index = offset;
    if (index < 4 || index + 32 > data.length) {
      offset = index + marker.length;
      continue;
    }
    const atomStart = index - 4;
    const atomSize = data.readUInt32BE(atomStart);
    if (atomSize < 24 || atomStart + atomSize > data.length) {
      offset = index + marker.length;
      continue;
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
      offset = index + marker.length;
      continue;
    }
    if (!timescale) {
      offset = index + marker.length;
      continue;
    }
    const corruptDuration = BigInt(timescale) * 9n;
    if (version === 0) {
      if (corruptDuration > 0xffffffffn) {
        throw new Error(type + ' duration does not fit version-0 header');
      }
      data.writeUInt32BE(Number(corruptDuration), durationOffset);
    } else {
      data.writeBigUInt64BE(corruptDuration, durationOffset);
    }
    count++;
    offset = index + marker.length;
  }
  return count;
}

const movieHeaders = rewriteDurationAtoms('mvhd');
const trackHeaders = rewriteDurationAtoms('mdhd');
if (movieHeaders !== 1 || trackHeaders < 1) {
  console.error('Expected one mvhd and at least one mdhd; found mvhd=' +
    movieHeaders + ', mdhd=' + trackHeaders);
  process.exit(1);
}
fs.writeFileSync(file, data);
console.log('Created MP4 fixture with 9-second movie/track duration headers and unchanged media packets.');
