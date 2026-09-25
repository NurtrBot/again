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
      '-loop', '1', '-framerate', '30', '-i', input,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-filter_complex',
      "[0:v]fps=30,scale=w='1280*(1+0.06*t/10)':h='960*(1+0.06*t/10)':eval=frame:flags=lanczos,crop=1280:960:'(iw-1280)/2':'(ih-960)/2',format=yuv420p[v]",
      '-map', '[v]', '-map', '1:a',
      '-t', '10', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-shortest', '-movflags', '+faststart',
      output,
    ],
    { stdio: 'inherit' },
  );
}
