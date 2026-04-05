# Keep Next.js running on EC2 after you close SSH

When you run `npm run start` in an SSH session, it is tied to that shell. **Closing the terminal sends SIGHUP and stops the server.**

Use one of these patterns.

## Option A: PM2 (simple for Node)

**Important:** PM2 does **not** load `.env.production` for you. If `OPENAI_API_KEY` (or `NEXTAUTH_*`, `CRON_SECRET`, etc.) is missing under PM2 but works in an SSH shell, the shell had `source .env.production` and PM2 did not.

### Recommended: use the repo `ecosystem.config.cjs`

This file uses **dotenv** to read **`.env.production`** in the project root and passes those variables into the Next.js process.

1. On EC2, create **`/home/ec2-user/auto-apply/.env.production`** with real values (file is often not in git). Include at least:

   ```bash
   OPENAI_API_KEY=sk-...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=https://your-domain.com
   CRON_SECRET=...
   ```

2. Install PM2 and start from the app directory (after `npm run build`):

```bash
sudo npm install -g pm2
cd /home/ec2-user/auto-apply
pm2 delete auto-apply 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Run the `sudo env PATH=... pm2 startup ...` command PM2 prints so it survives reboot.

3. After editing `.env.production`:

```bash
pm2 restart auto-apply --update-env
```

Useful commands:

```bash
pm2 status
pm2 logs auto-apply
pm2 env 0
```

(`pm2 env 0` shows env for the first app; confirm `OPENAI_API_KEY` is set — it may be redacted in newer PM2; you can also `pm2 logs` and trigger AI fill to see if the warning is gone.)

### Alternative: source then start (no ecosystem file)

```bash
cd /home/ec2-user/auto-apply
set -a && source .env.production && set +a
pm2 start npm --name auto-apply -- run start -- -H 0.0.0.0 -p 3001
pm2 save
```

If you use this path, you must **repeat the `source` + `pm2 restart`** whenever secrets change, or PM2 will keep the old environment.

## Option B: systemd (no extra global npm tools)

Create a unit file (adjust paths and user):

```bash
sudo nano /etc/systemd/system/auto-apply.service
```

```ini
[Unit]
Description=Auto Apply Next.js
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/auto-apply
Environment=NODE_ENV=production
EnvironmentFile=/home/ec2-user/auto-apply/.env.production
ExecStart=/usr/bin/npm run start -- -H 0.0.0.0 -p 3001
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ensure `npm` path matches your server (`which npm`).

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable auto-apply
sudo systemctl start auto-apply
sudo systemctl status auto-apply
```

Logs:

```bash
journalctl -u auto-apply -f
```

After editing `.env.production`:

```bash
sudo systemctl restart auto-apply
```

## Option C: tmux or screen (quick test only)

Survives **disconnect** but not a polished production setup (reboot kills it unless you reattach and restart).

```bash
tmux new -s app
cd /home/ec2-user/auto-apply && npm run start -- -H 0.0.0.0 -p 3001
# Detach: Ctrl+B then D
```

---

**Summary:** For production on EC2, use **PM2** or **systemd** so the app keeps running after SSH closes and can restart on failure or reboot.
