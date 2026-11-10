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

if (!file) fail('Usage: node validate-media.mjs <file> --container mp4|webm [--require-audio]');
if (!['mp4', 'webm'].includes(expectedContainer)) fail('Expected --container mp4 or webm');
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
  'format=format_name,duration:stream=codec_type,codec_name,width,height',
  '-of', 'json', file
]));
const formatNames = String(probe.format?.format_name || '').split(',');
const expectedFormat = expectedContainer === 'mp4' ? 'mp4' : 'webm';
if (!formatNames.includes(expectedFormat)) fail(`Container mismatch: expected ${expectedFormat}, got ${formatNames.join(',') || 'unknown'}`);

const streams = probe.streams || [];
const video = streams.find((stream) => stream.codec_type === 'video');
const audio = streams.find((stream) => stream.codec_type === 'audio');
if (!video) fail('No video stream found');
if (!Number.isInteger(video.width) || !Number.isInteger(video.height) || video.width < 2 || video.height < 2) {
  fail('Video dimensions are missing or invalid');
}
if (!video.codec_name) fail('Video codec is missing');
if (requireAudio && !audio) fail('Audio stream is required but missing');
if (requireAudio && !audio.codec_name) fail('Audio codec is missing');

const formatDuration = Number(probe.format?.duration);
if (!Number.isFinite(formatDuration) || formatDuration <= 0) fail('Container duration is missing or invalid');

// Some WebM files omit stream-level duration metadata. Measure each stream from
// its packet timestamps instead of copying the container duration into both tracks.
function packetTiming(selector, label) {
  const output = run('ffprobe', [
    '-v', 'error', '-select_streams', selector, '-show_packets',
    '-show_entries', 'packet=pts_time,duration_time', '-of', 'csv=p=0', file
  ]);
  let firstTimestamp = Infinity;
  let lastPacketEnd = -Infinity;
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [timestampText, durationText] = line.split(',');
    const timestamp = Number(timestampText);
    const duration = Number(durationText);
    if (!Number.isFinite(timestamp) || !Number.isFinite(duration) || duration <= 0) continue;
    firstTimestamp = Math.min(firstTimestamp, timestamp);
    lastPacketEnd = Math.max(lastPacketEnd, timestamp + duration);
  }
  const measuredDuration = lastPacketEnd - firstTimestamp;
  if (!Number.isFinite(measuredDuration) || measuredDuration <= 0) {
    fail(`${label} stream packet timing is missing or invalid; refusing to substitute container duration`);
  }
  return {start: firstTimestamp, duration: measuredDuration};
}

const videoTiming = packetTiming('v:0', 'Video');
const audioTiming = audio ? packetTiming('a:0', 'Audio') : null;
const videoDuration = videoTiming.duration;
const audioDuration = audioTiming?.duration ?? null;
if (audio && Math.abs(videoDuration - audioDuration) > 0.25) {
  fail(`Audio/video duration mismatch exceeds 0.25 s (video=${videoDuration}, audio=${audioDuration})`);
}
if (audio && Math.abs(videoTiming.start - audioTiming.start) > 0.25) {
  fail(`Audio/video start-time offset exceeds 0.25 s (video=${videoTiming.start}, audio=${audioTiming.start})`);
}

// Decode every frame and every audio sample independently; metadata alone is not sufficient.
run('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:v:0', '-f', 'null', '-']);
if (audio) run('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:a:0', '-f', 'null', '-']);

console.log([
  'MEDIA_INTEGRITY: PASS',
  `container=${expectedContainer}`,
  `size=${stat.size}`,
  `video=${video.codec_name} ${video.width}x${video.height} ${videoDuration.toFixed(3)}s`,
  audio ? `audio=${audio.codec_name} ${audioDuration.toFixed(3)}s` : 'audio=absent (allowed)',
  'decode=full video and available audio streams'
].join(' | '));
