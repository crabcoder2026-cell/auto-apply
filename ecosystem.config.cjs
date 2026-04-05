/**
 * PM2: loads .env.production into the Node process env (PM2 does not do this by itself).
 * On EC2: put secrets in .env.production (same folder), then:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * If you change .env.production: pm2 restart auto-apply --update-env
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.production') });

const PASS_THROUGH = [
  'OPENAI_API_KEY',
  'LLM_API_KEY',
  'LLM_API_BASE_URL',
  'LLM_MODEL',
  'OPENAI_ORG_ID',
  'ABACUSAI_API_KEY',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'CRON_SECRET',
  'CHROME_PATH',
  'PUPPETEER_EXECUTABLE_PATH',
  'USE_SPARTICUZ_CHROMIUM',
  'DATA_DIR',
  'STORAGE_DRIVER',
  'UPLOAD_DIR',
  'AWS_REGION',
  'AWS_BUCKET_NAME',
  'AWS_FOLDER_PREFIX',
];

const fromEnv = {};
for (const k of PASS_THROUGH) {
  const v = process.env[k];
  if (v !== undefined && v !== '') {
    fromEnv[k] = v;
  }
}

module.exports = {
  apps: [
    {
      name: 'auto-apply',
      cwd: __dirname,
      script: 'npm',
      args: 'run start -- -H 0.0.0.0 -p 3001',
      env: {
        NODE_ENV: 'production',
        ...fromEnv,
      },
    },
  ],
};
