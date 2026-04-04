# Running locally (no cloud database)

## Prerequisites

- Node.js 20+
- Google Chrome or Chromium (for Puppeteer)

## Data storage

Users, application templates, and application history are stored in **`data/store.json`** (created on first use). Optional env **`DATA_DIR`** overrides the directory (the file is always `store.json` inside that folder).

Resumes are stored on disk under **`uploads/`** when using local storage mode (default when `AWS_BUCKET_NAME` is unset).

## Setup

1. Copy environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local`: set `NEXTAUTH_SECRET`. Set `CHROME_PATH` only if Apply fails to find the browser (macOS usually auto-detects Chrome under `/Applications`).

3. Install dependencies:

   ```bash
   npm install
   ```

4. (Optional) Seed a demo account:

   ```bash
   npm run seed
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000), sign up or use the seeded account, configure **Template**, upload a resume, then use **Apply**.

## Auto Search (curated job feed)

The **Auto Search** tab reads a shared cache in `data/store.json` (`jobFeedCache`). The cache is built with **headless Chrome**: each board URL is opened and job links are scraped from the HTML (not the Greenhouse public API). You need a working Chrome/Chromium path (see **Browser modes** below).

Populate the cache by calling the cron endpoint locally (requires `CRON_SECRET` in `.env.local`):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/job-feed"
```

On a VPS or EC2, use the same `curl` with your public `NEXTAUTH_URL` on a **systemd timer** or **crontab** every 30 minutes. Full directory scrapes can take several minutes; self-hosted Node is more reliable than short-lived serverless for this job.

## Storage modes

- **Local disk** (default): resumes under `uploads/`; metadata in `data/store.json`.
- **S3**: set `STORAGE_DRIVER=s3` and AWS bucket variables.

## Browser modes

- **Local Chrome**: set `CHROME_PATH` or `PUPPETEER_EXECUTABLE_PATH`.
- **Serverless Chromium**: set `USE_SPARTICUZ_CHROMIUM=true` or deploy on AWS Lambda.

## Optional AI filling (OpenAI)

In `.env.local` set **`OPENAI_API_KEY`** (from [OpenAI API keys](https://platform.openai.com/api-keys)). Default base URL is `https://api.openai.com/v1` and default model is **`gpt-4o-mini`** (override with **`LLM_MODEL`**). For org accounts you can set **`OPENAI_ORG_ID`**.

Other OpenAI-compatible hosts: set **`LLM_API_BASE_URL`** and **`LLM_API_KEY`** instead.
