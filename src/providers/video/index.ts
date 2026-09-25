import { getEnv } from '@/src/server/env';
import { HiggsfieldProvider } from './higgsfield';
import { SoraProvider } from './sora';
import { MockVideoProvider } from './mock';
import type { VideoProvider } from './types';

let instance: VideoProvider | null = null;
export function videoProvider(): VideoProvider {
  if (instance) return instance;
  const env = getEnv();
  instance = env.VIDEO_PROVIDER === 'higgsfield' ? new HiggsfieldProvider() : env.VIDEO_PROVIDER === 'sora' ? new SoraProvider() : new MockVideoProvider();
  return instance;
}
export * from './types';
