/* Builds labeled demo renders for the sample strip: a slow push-in of each
 * sample still, 10.0s, 24fps, H.264 + silent AAC. These are NOT AI films.
 */
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const samples = ['dog-beach', 'family-park', 'restaurant'];
for (const name of samples) {
  const input = resolve('public/samples', `${name}.jpg`);
  const output = resolve('public/samples', `${name}.mp4`);
  if (!existsSync(input)) continue;
  console.log(`rendering ${name}.mp4`);
  execFileSync(
    ffmpegPath as string,
    [
      '-y',
      '-loop', '1', '-i', input,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-filter_complex',
      "[0:v]scale=1600:-2,zoompan=z='min(1.0+0.06*on/240,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=240:s=1280x960:fps=24,format=yuv420p[v]",
      '-map', '[v]', '-map', '1:a',
      '-t', '10', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-shortest', '-movflags', '+faststart',
      output,
    ],
    { stdio: 'inherit' },
  );
}
