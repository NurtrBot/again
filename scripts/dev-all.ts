/* Runs the web app and the worker together for local development. */
import { spawn } from 'node:child_process';

const procs = [
  spawn('npx', ['next', 'dev', '-p', process.env.PORT ?? '3100'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn('npx', ['tsx', 'watch', 'worker/main.ts'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];
const stop = () => {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => (code && code !== 0 ? stop() : undefined));
