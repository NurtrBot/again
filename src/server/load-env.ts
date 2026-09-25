import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Minimal dotenv for scripts and the worker (Next.js loads .env.local itself). */
/** Loads .env then .env.local (or the file named by ENV_FILE, e.g. ENV_FILE=.env.hosted npm run worker). */
export function loadEnv(cwd = process.cwd()) {
  const files = process.env.ENV_FILE ? ['.env', process.env.ENV_FILE] : ['.env', '.env.local'];
  for (const name of files) {
    const file = resolve(cwd, name);
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      const hash = value.search(/\s#/);
      if (hash >= 0 && !value.startsWith('"')) value = value.slice(0, hash).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
