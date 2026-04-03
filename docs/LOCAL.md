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

## Storage modes

- **Local disk** (default): resumes under `uploads/`; metadata in `data/store.json`.
- **S3**: set `STORAGE_DRIVER=s3` and AWS bucket variables.

## Browser modes

- **Local Chrome**: set `CHROME_PATH` or `PUPPETEER_EXECUTABLE_PATH`.
- **Serverless Chromium**: set `USE_SPARTICUZ_CHROMIUM=true` or deploy on AWS Lambda.

## Optional AI filling (OpenAI)

In `.env.local` set **`OPENAI_API_KEY`** (from [OpenAI API keys](https://platform.openai.com/api-keys)). Default base URL is `https://api.openai.com/v1` and default model is **`gpt-4o-mini`** (override with **`LLM_MODEL`**). For org accounts you can set **`OPENAI_ORG_ID`**.

Other OpenAI-compatible hosts: set **`LLM_API_BASE_URL`** and **`LLM_API_KEY`** instead.
