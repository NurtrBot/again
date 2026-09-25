import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);
const FFMPEG = ffmpegPath as string;
const FFPROBE = ffprobeStatic.path;

export interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
  codec: string | null;
  byteLength: number;
}

export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await exec(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  const json = JSON.parse(stdout) as { format?: { duration?: string; size?: string }; streams?: Array<{ codec_type: string; width?: number; height?: number; codec_name?: string; duration?: string }> };
  const video = json.streams?.find((s) => s.codec_type === 'video');
  const audio = json.streams?.find((s) => s.codec_type === 'audio');
  const duration = Number(json.format?.duration ?? video?.duration ?? 0);
  return {
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    hasVideo: !!video,
    hasAudio: !!audio,
    codec: video?.codec_name ?? null,
    byteLength: Number(json.format?.size ?? 0),
  };
}

export async function tempDir(prefix = 'again-'): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** Poster JPEG from the first representative frame (t=0.2s). */
export async function extractPoster(video: string, out: string): Promise<void> {
  await exec(FFMPEG, ['-y', '-ss', '0.2', '-i', video, '-frames:v', '1', '-q:v', '3', out], { timeout: 60_000 });
}

/** Sample N frames evenly for quality review. Returns file paths. */
export async function sampleFrames(video: string, dir: string, count = 4, duration = 10): Promise<string[]> {
  const files: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) * duration) / count;
    const out = join(dir, `frame-${i + 1}.jpg`);
    await exec(FFMPEG, ['-y', '-ss', t.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=768:-2', '-q:v', '4', out], { timeout: 60_000 });
    files.push(out);
  }
  return files;
}

/** Re-mux/trim to an exact duration (used when a provider can only produce 12s). Re-encodes for frame-accurate cut. */
export async function trimTo(video: string, out: string, seconds: number): Promise<void> {
  await exec(FFMPEG, ['-y', '-i', video, '-t', seconds.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { timeout: 300_000 });
}

/** High-quality upscale to a target long edge (lanczos + light unsharp), high-bitrate H.264, audio copied. */
export async function upscaleTo(video: string, out: string, longEdge: number, dims: { width: number; height: number }): Promise<void> {
  const landscape = dims.width >= dims.height;
  const scale = landscape ? `scale=${longEdge}:-2:flags=lanczos` : `scale=-2:${longEdge}:flags=lanczos`;
  await exec(FFMPEG, ['-y', '-i', video, '-vf', `${scale},unsharp=5:5:0.35:5:5:0.0,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-profile:v', 'high', '-level', '5.1', '-c:a', 'copy', '-movflags', '+faststart', out], { timeout: 600_000 });
}

/** Normalize container for playback (faststart) without re-encoding when possible. */
export async function remuxFaststart(video: string, out: string): Promise<void> {
  await exec(FFMPEG, ['-y', '-i', video, '-c', 'copy', '-movflags', '+faststart', out], { timeout: 120_000 });
}

/**
 * Demo render: a slow push-in of the still with silent stereo audio. Clearly NOT AI motion;
 * exists so the whole pipeline (storage, gate, poster, playback, share) can be exercised without provider keys.
 */
export async function renderDemoPushIn(image: string, out: string, opts: { width: number; height: number; seconds?: number }): Promise<void> {
  const seconds = opts.seconds ?? 10;
  const fps = 30;
  // Even dimensions, max 1280 long edge.
  const scale = Math.min(1, 1280 / Math.max(opts.width, opts.height));
  const w = Math.max(2, Math.round((opts.width * scale) / 2) * 2);
  const h = Math.max(2, Math.round((opts.height * scale) / 2) * 2);
  // Smooth sub-pixel push-in: per-frame scale (eval=frame, time-based) then a fixed centered crop.
  // Unlike zoompan this has no integer stepping, so motion is continuous.
  const zoomEnd = 1.06;
  const z = `(1+${zoomEnd - 1}*t/${seconds})`;
  const filter = [
    `[0:v]fps=${fps}`,
    `scale=w='${w}*${z}':h='${h}*${z}':eval=frame:flags=lanczos`,
    `crop=${w}:${h}:'(iw-${w})/2':'(ih-${h})/2'`,
    `format=yuv420p[v]`,
  ].join(',');
  await exec(
    FFMPEG,
    ['-y', '-loop', '1', '-framerate', String(fps), '-i', image, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-filter_complex', filter, '-map', '[v]', '-map', '1:a', '-t', String(seconds), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out],
    { timeout: 300_000 },
  );
}
