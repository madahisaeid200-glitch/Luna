#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

function fail(message) {
  console.error(`MEDIA_INTEGRITY: FAIL — ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const expectedContainer = option('--container');
const requireAudio = args.includes('--require-audio');
const profile = option('--profile');

if (!file) fail('Usage: node validate-media.mjs <file> --container mp4|webm [--require-audio] [--profile instagram-mp4]');
if (!['mp4', 'webm'].includes(expectedContainer)) fail('Expected --container mp4 or webm');
if (profile && profile !== 'instagram-mp4') fail('Expected --profile instagram-mp4 when a profile is supplied');
if (profile === 'instagram-mp4' && expectedContainer !== 'mp4') fail('The instagram-mp4 profile requires an MP4 container');
if (!fs.existsSync(file)) fail(`File does not exist: ${file}`);

const stat = fs.statSync(file);
if (!stat.isFile() || stat.size < 1024) fail('Output is not a regular media file of at least 1 KiB');

const fd = fs.openSync(file, 'r');
const header = Buffer.alloc(16);
fs.readSync(fd, header, 0, header.length, 0);
fs.closeSync(fd);
if (expectedContainer === 'mp4' && header.toString('ascii', 4, 8) !== 'ftyp') {
  fail('MP4 file signature is missing (expected ftyp box)');
}
if (expectedContainer === 'webm' && !header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
  fail('WebM EBML signature is missing');
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  if (result.error) fail(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result.stdout;
}

const probe = JSON.parse(run('ffprobe', [
  '-v', 'error', '-show_entries',
  'format=format_name,start_time,duration:stream=index,codec_type,codec_name,width,height',
  '-of', 'json', file
]));
const formatNames = String(probe.format?.format_name || '').split(',');
const expectedFormat = expectedContainer === 'mp4' ? 'mp4' : 'webm';
if (!formatNames.includes(expectedFormat)) fail(`Container mismatch: expected ${expectedFormat}, got ${formatNames.join(',') || 'unknown'}`);

const streams = probe.streams || [];
const videoStreams = streams.filter((stream) => stream.codec_type === 'video');
const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
if (videoStreams.length !== 1) {
  fail(`Expected exactly one video stream; found ${videoStreams.length}. Multi-video outputs are not supported by this profile`);
}
if (audioStreams.length > 1) {
  fail(`Expected at most one audio stream; found ${audioStreams.length}. Multi-audio outputs must be normalized before validation`);
}
const video = videoStreams[0];
const audio = audioStreams[0] || null;
if (!video) fail('No video stream found');
if (!Number.isInteger(video.width) || !Number.isInteger(video.height) || video.width < 2 || video.height < 2) {
  fail('Video dimensions are missing or invalid');
}
if (!video.codec_name) fail('Video codec is missing');
if (requireAudio && !audio) fail('Audio stream is required but missing');
if (requireAudio && !audio.codec_name) fail('Audio codec is missing');
if (profile === 'instagram-mp4') {
  if (!audio) fail('The instagram-mp4 profile requires an audio stream');
  if (video.codec_name !== 'h264') fail(`The instagram-mp4 profile requires H.264 video; found ${video.codec_name}`);
  if (audio.codec_name !== 'aac') fail(`The instagram-mp4 profile requires AAC audio; found ${audio.codec_name}`);
}

const formatDuration = Number(probe.format?.duration);
if (!Number.isFinite(formatDuration) || formatDuration <= 0) fail('Container duration is missing or invalid');
const formatStart = Number(probe.format?.start_time);
const hasFormatStart = Number.isFinite(formatStart);

// FFprobe's MP4 format duration can be packet-derived and may hide a corrupt
// movie-header duration. Read only the moov atom and validate mvhd independently.
function readExact(fd, length, position) {
  const buffer = Buffer.alloc(length);
  const bytesRead = fs.readSync(fd, buffer, 0, length, position);
  if (bytesRead !== length) fail('MP4 metadata is truncated');
  return buffer;
}
function parseBoxes(buffer, start, end) {
  const boxes = [];
  let cursor = start;
  while (cursor + 8 <= end) {
    const size32 = buffer.readUInt32BE(cursor);
    const type = buffer.toString('ascii', cursor + 4, cursor + 8);
    let size = size32;
    let headerSize = 8;
    if (size32 === 1) {
      if (cursor + 16 > end) fail('MP4 extended atom header is truncated');
      const extendedSize = buffer.readBigUInt64BE(cursor + 8);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) fail('MP4 atom exceeds safe size limits');
      size = Number(extendedSize);
      headerSize = 16;
    } else if (size32 === 0) {
      size = end - cursor;
    }
    if (size < headerSize || cursor + size > end) fail('MP4 atom has invalid bounds: ' + type);
    boxes.push({type, payload: cursor + headerSize, end: cursor + size, size});
    cursor += size;
  }
  if (cursor !== end) fail('MP4 atom table has trailing bytes');
  return boxes;
}
function readMp4MovieDuration(path) {
  const fd = fs.openSync(path, 'r');
  try {
    const fileSize = fs.fstatSync(fd).size;
    let cursor = 0;
    let movie = null;
    while (cursor + 8 <= fileSize) {
      const header = readExact(fd, 8, cursor);
      const size32 = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      let atomSize = size32;
      let headerSize = 8;
      if (size32 === 1) {
        const extended = readExact(fd, 8, cursor + 8).readBigUInt64BE(0);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) fail('MP4 top-level atom exceeds safe size limits');
        atomSize = Number(extended);
        headerSize = 16;
      } else if (size32 === 0) {
        atomSize = fileSize - cursor;
      }
      if (atomSize < headerSize || cursor + atomSize > fileSize) fail('MP4 top-level atom has invalid bounds: ' + type);
      if (type === 'moov') {
        if (atomSize > 32 * 1024 * 1024) fail('MP4 moov metadata exceeds 32 MiB safety limit');
        movie = readExact(fd, atomSize - headerSize, cursor + headerSize);
        break;
      }
      cursor += atomSize;
    }
    if (!movie) fail('MP4 moov atom is missing');
    const mvhd = parseBoxes(movie, 0, movie.length).find(atom => atom.type === 'mvhd');
    if (!mvhd) fail('MP4 movie header (mvhd) is missing');
    const version = movie[mvhd.payload];
    let timescale;
    let duration;
    if (version === 0) {
      if (mvhd.end - mvhd.payload < 20) fail('MP4 version-0 mvhd is truncated');
      timescale = movie.readUInt32BE(mvhd.payload + 12);
      duration = movie.readUInt32BE(mvhd.payload + 16);
    } else if (version === 1) {
      if (mvhd.end - mvhd.payload < 32) fail('MP4 version-1 mvhd is truncated');
      timescale = movie.readUInt32BE(mvhd.payload + 20);
      const rawDuration = movie.readBigUInt64BE(mvhd.payload + 24);
      if (rawDuration > BigInt(Number.MAX_SAFE_INTEGER)) fail('MP4 mvhd duration exceeds safe numeric range');
      duration = Number(rawDuration);
    } else {
      fail('Unsupported MP4 mvhd version: ' + version);
    }
    if (!timescale || duration === 0xffffffff || duration === Number.MAX_SAFE_INTEGER) {
      fail('MP4 mvhd duration or timescale is invalid/unknown');
    }
    const seconds = duration / timescale;
    if (!Number.isFinite(seconds) || seconds <= 0) fail('MP4 mvhd duration is invalid');
    return seconds;
  } finally {
    fs.closeSync(fd);
  }
}
const mp4MovieDuration = expectedContainer === 'mp4' ? readMp4MovieDuration(file) : null;

// Some WebM files omit stream-level duration metadata. Measure each stream from
// its packet timestamps instead of copying the container duration into both tracks.
function packetTiming(selector, label) {
  const output = run('ffprobe', [
    '-v', 'error', '-select_streams', selector, '-show_packets',
    '-show_entries', 'packet=pts_time,duration_time', '-of', 'json', file
  ]);
  let packets;
  try {
    packets = JSON.parse(output).packets;
  } catch {
    fail(`${label} stream packet timing is not valid FFprobe JSON`);
  }
  if (!Array.isArray(packets) || packets.length === 0) {
    fail(`${label} stream contains no measurable packets`);
  }
  let firstTimestamp = Infinity;
  let lastPacketEnd = -Infinity;
  for (let index = 0; index < packets.length; index += 1) {
    const packet = packets[index];
    const timestamp = Number(packet.pts_time);
    const duration = Number(packet.duration_time);
    if (!Number.isFinite(timestamp) || !Number.isFinite(duration) || duration <= 0) {
      fail(`${label} stream packet ${index} has missing or invalid PTS/duration; refusing partial-timeline validation`);
    }
    firstTimestamp = Math.min(firstTimestamp, timestamp);
    lastPacketEnd = Math.max(lastPacketEnd, timestamp + duration);
  }
  const measuredDuration = lastPacketEnd - firstTimestamp;
  if (!Number.isFinite(measuredDuration) || measuredDuration <= 0) {
    fail(`${label} stream packet timeline is invalid; refusing to substitute container duration`);
  }
  return {start: firstTimestamp, end: lastPacketEnd, duration: measuredDuration, packetCount: packets.length};
}

const videoTiming = packetTiming('v:0', 'Video');
const audioTiming = audio ? packetTiming('a:0', 'Audio') : null;
const audioDuration = audioTiming?.duration ?? null;
if (audio && Math.abs(videoTiming.duration - audioDuration) > 0.25) {
  fail(`Audio/video duration mismatch exceeds 0.25 s (video=${videoTiming.duration}, audio=${audioDuration})`);
}
if (audio && Math.abs(videoTiming.start - audioTiming.start) > 0.25) {
  fail(`Audio/video start-time offset exceeds 0.25 s (video=${videoTiming.start}, audio=${audioTiming.start})`);
}

// Container timing is checked against the complete packet timeline, not just
// the difference between the audio and video tracks. A 250 ms tolerance allows
// normal codec/container time-base rounding while rejecting material metadata drift.
const timelineStart = audioTiming ? Math.min(videoTiming.start, audioTiming.start) : videoTiming.start;
const timelineEnd = audioTiming ? Math.max(videoTiming.end, audioTiming.end) : videoTiming.end;
const timelineDuration = timelineEnd - timelineStart;
if (expectedContainer === 'mp4' && Math.abs(mp4MovieDuration - timelineDuration) > 0.25) {
  fail(`MP4 mvhd/container duration mismatch exceeds 0.25 s (mvhd=${mp4MovieDuration}, streams=${timelineDuration})`);
}
if (hasFormatStart && Math.abs(formatStart - timelineStart) > 0.25) {
  fail(`Container start-time mismatch exceeds 0.25 s (container=${formatStart}, streams=${timelineStart})`);
}
if (Math.abs(formatDuration - timelineDuration) > 0.25) {
  fail(`Container/stream duration mismatch exceeds 0.25 s (container=${formatDuration}, streams=${timelineDuration})`);
}
if (hasFormatStart && Math.abs((formatStart + formatDuration) - timelineEnd) > 0.25) {
  fail(`Container end-time mismatch exceeds 0.25 s (container=${formatStart + formatDuration}, streams=${timelineEnd})`);
}

// Decode every frame and every audio sample independently; metadata alone is not sufficient.
run('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:v:0', '-f', 'null', '-']);
if (audio) run('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:a:0', '-f', 'null', '-']);

console.log([
  'MEDIA_INTEGRITY: PASS',
  `container=${expectedContainer}`,
  `size=${stat.size}`,
  `video=${video.codec_name} ${video.width}x${video.height} ${videoTiming.duration.toFixed(3)}s`,
  audio ? `audio=${audio.codec_name} ${audioDuration.toFixed(3)}s` : 'audio=absent (allowed)',
  `containerTimeline=${formatDuration.toFixed(3)}s`,
  'decode=full video and available audio streams',
  'streamPolicy=exactly one video and at most one audio',
  profile ? `profile=${profile}` : 'profile=generic-integrity',
  `videoPackets=${videoTiming.packetCount}`,
  audio ? `audioPackets=${audioTiming.packetCount}` : 'audioPackets=0'
].join(' | '));
