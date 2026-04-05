# Cron on EC2 (Auto pilot + Auto Search)

Your Next.js app does not wake itself. On EC2 you schedule HTTP calls to the protected cron routes using the same **`CRON_SECRET`** and **`NEXTAUTH_URL`** as the running server.

The app must stay running after you close SSH — use **PM2** or **systemd** ([EC2-KEEP-SERVER-UP.md](./EC2-KEEP-SERVER-UP.md)).

### Quick fix: `CRON_SECRET is empty` in cron scripts

Cron reads **`.env.production`** (not your SSH session). Add variables with:

```bash
export CRON_SECRET='same-as-nextjs'
export NEXTAUTH_URL='https://your-domain.com'
./scripts/ec2-set-cron-env.sh
```

## 1. Env file on the server

Use the **same** values as your production app (e.g. `.env.production` next to the app, or a small file only for cron).

Required keys:

| Variable | Example | Notes |
|----------|---------|--------|
| `CRON_SECRET` | long random string | Must match the app process env |
| `NEXTAUTH_URL` | `https://jobs.example.com` | Public URL users use, **or** `http://127.0.0.1:3000` if you only curl from the same instance |

Optional for Auto Search job feed (Chrome scrape):

| Variable | Example |
|----------|---------|
| `CHROME_PATH` | `/usr/bin/google-chrome-stable` |

Set on the **Node/systemd process** that runs `next start`, not only in the cron env file, if the app needs Chrome for `/api/cron/job-feed`.

**Permissions:** restrict who can read secrets:

```bash
sudo mkdir -p /etc/auto-apply
sudo nano /etc/auto-apply/cron.env
# CRON_SECRET=...
# NEXTAUTH_URL=https://your-domain.com
sudo chmod 600 /etc/auto-apply/cron.env
sudo chown root:root /etc/auto-apply/cron.env
```

If the app lives in `/home/ubuntu/auto-apply`, you can instead use `/home/ubuntu/auto-apply/.env.production` and pass that path to the scripts (see below).

## 2. Install scripts

After `git pull`, from the repo root:

```bash
chmod +x scripts/ec2-cron-common.sh scripts/ec2-cron-watch.sh scripts/ec2-cron-job-feed.sh
```

### `CRON_SECRET is empty` on EC2

The cron scripts read **`CRON_SECRET` and `NEXTAUTH_URL` from the env file you pass** (default: `.env.production` in the repo). They do **not** read systemd/pm2’s environment.

1. **Add the line to that file** on the server (same secret the app uses):

   ```bash
   nano /home/ec2-user/auto-apply/.env.production
   ```

   Ensure you have exactly (no spaces around `=`):

   ```bash
   CRON_SECRET=your-long-random-secret-here
   NEXTAUTH_URL=https://your-public-domain.com
   ```

2. **Match the running app:** whatever starts Next (`systemd`, `pm2`, etc.) must also set **`CRON_SECRET`** to the same string (often by loading the same `.env.production` or `EnvironmentFile=`).

3. If you edited the file on Windows, CRLF was breaking variable names; the scripts now strip `\r`, but you should still save `CRON_SECRET=` on its own line.

## 3. Test manually (on EC2)

```bash
cd /path/to/auto-apply

# If using project .env.production:
./scripts/ec2-cron-watch.sh /path/to/auto-apply/.env.production
./scripts/ec2-cron-job-feed.sh /path/to/auto-apply/.env.production

# Or if using /etc/auto-apply/cron.env:
export CRON_ENV_FILE=/etc/auto-apply/cron.env
./scripts/ec2-cron-watch.sh
./scripts/ec2-cron-job-feed.sh
```

You should see JSON like `{"ok":true,...}` (not `Unauthorized`). If `curl` fails with connection refused, fix `NEXTAUTH_URL` or ensure `next start` / your process manager is listening on that host/port.

## 4. Crontab (ubuntu user example)

```bash
crontab -e
```

Use **absolute paths** to your clone and env file:

```cron
# Auto pilot — every 10 minutes
*/10 * * * * /home/ubuntu/auto-apply/scripts/ec2-cron-watch.sh /home/ubuntu/auto-apply/.env.production >> /var/log/auto-apply-watch.log 2>&1

# Auto Search job feed — every 30 minutes (headless Chrome; can take several minutes)
*/30 * * * * /home/ubuntu/auto-apply/scripts/ec2-cron-job-feed.sh /home/ubuntu/auto-apply/.env.production >> /var/log/auto-apply-job-feed.log 2>&1
```

Replace `/home/ubuntu/auto-apply` with your real deploy path.

## 5. Chrome on EC2 (job-feed)

Install Google Chrome or Chromium and set **`CHROME_PATH`** in the environment of the **Next.js** service (and ensure the user running Node can execute it), for example:

```bash
which google-chrome-stable || which chromium-browser || which chromium
```

If job-feed returns errors about Chrome, check that path and that the instance has enough RAM for headless runs.

## 6. systemd timer (alternative to crontab)

You can use `OnCalendar=*:0/10` and `OnCalendar=*:0/30` in timer units that `ExecStart` the same script paths; keep `User=` and ensure the unit has access to the env file or use `EnvironmentFile=/etc/auto-apply/cron.env` **only** if you duplicate `CRON_SECRET`/`NEXTAUTH_URL` there for curl (the app still needs its own env from your usual deployment).

## 7. Logs

```bash
sudo tail -f /var/log/auto-apply-watch.log
sudo tail -f /var/log/auto-apply-job-feed.log
```

Non-zero exit from the scripts usually means `curl -f` got HTTP 4xx/5xx or connection failure.
