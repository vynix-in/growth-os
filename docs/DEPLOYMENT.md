# Deployment

The system is meant to run on a schedule and leave a person in charge of
approvals. There are two parts to keep running: the hourly orchestration pass and
the dashboard.

## Hourly orchestration with cron

Run one pass every hour. Each pass runs the agents in priority order, refreshes
the dashboard snapshot, and writes a report.

```bash
bash cron/install-cron.sh
```

This adds a crontab line like:

```
0 * * * * cd /home/azureuser/PinPoint/growth && /usr/bin/node bin/vynix-growth.js orchestrate >> logs/cron.log 2>&1
```

If you use Azure AI Foundry, put the four environment variables in a file the
cron job can read, or export them in the crontab entry. Without them the pass
still runs on templates.

## Running the dashboard as a service

The dashboard is a plain Node server. To keep it running, use a process manager
or a systemd unit. A minimal systemd unit:

```ini
[Unit]
Description=Vynix Growth OS dashboard
After=network.target

[Service]
WorkingDirectory=/home/azureuser/PinPoint/growth
ExecStart=/usr/bin/node bin/vynix-growth.js dashboard
Restart=on-failure
User=azureuser

[Install]
WantedBy=multi-user.target
```

The dashboard binds to 127.0.0.1 by default. To reach it from outside the box,
put it behind a reverse proxy with authentication. Do not expose it directly; it
can approve publishing.

## Publishing repositories

Publishing uses the GitHub CLI (`gh`) and pushes to the `vynix-in` organisation.
The publisher refuses to run unless the repository proposal is approved in the
dashboard and its files pass the publication gate.

```bash
gh auth status                                 # confirm you are signed in
node bin/vynix-growth.js publish vynix-mcp --dry-run   # see what would happen
node bin/vynix-growth.js publish vynix-mcp             # create and push the repo
```

If the organisation cannot be used, the publisher falls back to the configured
personal owner.

## Backups

The whole system is files. Back up the `database/` folder and the generated
content folders. There is nothing else to save.
