import { loadEnv } from '../src/server/load-env';
loadEnv();
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL || 'postgres://localhost:5432/again_test';
process.env.APP_MODE = 'mock';
process.env.APP_SECRET = process.env.APP_SECRET || 'test-secret-test-secret-test-secret';
process.env.LOCAL_MEDIA_DIR = '.data/test-media';
process.env.DEV_SEED_CREDITS = '0';
