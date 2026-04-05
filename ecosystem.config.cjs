/**
 * PM2: start Next with dotenv preloaded so .env.production is in process.env
 * before `next start` runs (fixes OPENAI_API_KEY etc. missing when using PM2 + npm).
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * Requires .env.production in the project root on the server (gitignored).
 */
const path = require('path');

const envProduction = path.join(__dirname, '.env.production');

module.exports = {
  apps: [
    {
      name: 'auto-apply',
      cwd: __dirname,
      interpreter: 'node',
      script: require.resolve('next/dist/bin/next'),
      args: 'start -H 0.0.0.0 -p 3001',
      node_args: '-r dotenv/config',
      env: {
        NODE_ENV: 'production',
        DOTENV_CONFIG_PATH: envProduction,
      },
    },
  ],
};
