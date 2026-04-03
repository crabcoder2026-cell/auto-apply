import { execSync } from 'child_process';

execSync('tsx --require dotenv/config scripts/seed.ts', { stdio: 'inherit' });
