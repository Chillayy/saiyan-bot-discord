# Deploying Saiyan Bot 24/7 on Oracle Cloud (Always Free)

Run the bot on a free Oracle Cloud VM so it stays online without your laptop.
Cost: **$0/month**. Time: **~30-45 minutes**, once.

Assumptions:
- Repo: `https://github.com/Chillayy/saiyan-bot-discord`
- **Push first:** the VM clones whatever is on GitHub, so commit and push your latest changes
  (`git add -A && git commit -m "Deploy prep" && git push`) before starting. The runtime files
  `saver.js`, `statModifier.js` and `baseSystem.js` must be committed or the bot will not start.
- `config/secrets.json` (your bot token + ids) and `data/` (live game state) are **gitignored**: a fresh
  clone has neither, so you upload both (Step 3). All the gameplay tunables ship in the committed
  `config/default-config.json`, so the clone is immediately runnable once the secrets are in place.
- The bot is one long-running Node process. It needs **no open inbound ports** - it only
  connects out to Discord. Never open extra ports for it.

---

## 1. Create the VM (browser)

1. Sign up at https://cloud.oracle.com - a credit card is needed for identity verification
   (Always Free resources are never charged). Pick your **home region** carefully; it cannot
   be changed later.
2. Compute > Instances > **Create instance**:
   - Image: **Ubuntu 24.04 LTS** (or 22.04)
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM, Always Free) with **1 OCPU / 6 GB RAM**
     (2 OCPU / 12 GB is still free and still overkill for this bot).
   - Boot volume: default (~47 GB, inside the 200 GB free block-storage allowance).
   - SSH keys: paste your **public** key (generate with `ssh-keygen -t ed25519` if needed).
3. If creation fails with "Out of host capacity": retry, switch Availability Domain, or use
   `VM.Standard.E2.1.Micro` (x86, 1 GB - enough for this bot; 2 are allowed).
4. Networking: keep the default VCN/subnet. **Do not add ingress rules.**
5. Recommended: Billing > Budgets > create a **$0.01 budget alert** so any accidental paid
   resource would be noticed immediately.

## 2. Server setup (SSH)

```bash
ssh ubuntu@<public-ip>

sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git  
node -v   # expect v22.x
```

## 3. Get the code, secrets and live data

On the **VM**:
```bash
git clone https://github.com/Chillayy/saiyan-bot-discord.git ~/saiyanbot
cd ~/saiyanbot && npm ci
```
(Private repo? Use a read-only deploy key or a personal access token.)

From your **Windows laptop** (PowerShell) - upload the secret config and your current save
data. Both are gitignored, so the clone does NOT contain them:
```powershell
scp "c:\Users\shema\saiyanbot\config\secrets.json" ubuntu@<public-ip>:~/saiyanbot/config/secrets.json
scp "c:\Users\shema\saiyanbot\data\characters.json" "c:\Users\shema\saiyanbot\data\world.json" "c:\Users\shema\saiyanbot\data\creationCooldowns.json" ubuntu@<public-ip>:~/saiyanbot/data/
```

Smoke test (Ctrl+C is safe - the saver flushes on SIGINT):
```bash
cd ~/saiyanbot && node index.js
```
You should see it log in. Slash commands auto-register on startup - no separate deploy step.

## 4. Run 24/7 with systemd

`sudo nano /etc/systemd/system/saiyanbot.service`:
```ini
[Unit]
Description=Saiyan Bot (Discord)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/saiyanbot
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now saiyanbot
systemctl status saiyanbot            # active (running)
journalctl -u saiyanbot -f -n 50      # live logs (Ctrl+C to stop watching)
```

Control it any time:
```bash
sudo systemctl restart saiyanbot
sudo systemctl stop saiyanbot
sudo systemctl start saiyanbot
```

---

## 5. Updating the bot

On the **VM**:
```bash
cd ~/saiyanbot
git pull
npm ci
sudo systemctl restart saiyanbot
```
`data/` and `config/secrets.json` are gitignored, so a pull can never clobber your live save or
credentials. If slash commands ever look out of sync, force-refresh them (stop the service first so
two gateway sessions don't overlap):
```bash
sudo systemctl stop saiyanbot
cd ~/saiyanbot && node deploy-commands.js
sudo systemctl start saiyanbot
```

## 6. Backups (the JSON files are the whole game)

On the VM run `crontab -e` and add a daily archive (keeps 14 days):
```
0 4 * * * mkdir -p ~/backups && tar czf ~/backups/data-$(date +\%F).tar.gz -C ~/saiyanbot data && find ~/backups -name 'data-*.tar.gz' -mtime +14 -delete
```

Also keep an off-VM copy (run occasionally from your laptop):
```powershell
scp -r ubuntu@<public-ip>:~/saiyanbot/data "c:\Users\shema\saiyanbot-data-backup"
```

Restore: `sudo systemctl stop saiyanbot`, copy the JSON files back into `~/saiyanbot/data/`,
then `sudo systemctl start saiyanbot`.

## 7. Verification checklist

- [ ] `systemctl status saiyanbot` says `active (running)`
- [ ] Bot is online in Discord and `/ping` responds
- [ ] Your laptop is no longer running its own copy (only ONE instance may run at a time)
- [ ] `ls ~/saiyanbot/data` shows characters.json, world.json, creationCooldowns.json
- [ ] `sudo reboot` -> the bot comes back online by itself within ~1 minute

## Troubleshooting

| Problem | Fix |
|---|---|
| Login fails / token invalid | Re-upload `config/secrets.json`; check `journalctl -u saiyanbot -n 100 --no-pager` |
| "Out of host capacity" on create | Try a different Availability Domain, or use the x86 `VM.Standard.E2.1.Micro` shape |
| Service "running" but bot silent | `journalctl -u saiyanbot -n 100 --no-pager` - the last log line says what it is waiting on |
| Old/renamed commands still visible | `node deploy-commands.js` (service stopped), then start the service again |
| VM public IP changed | The default IP is ephemeral (changes on stop/start); systemd doesn't care. Reserve an IP only if you add DNS later |
| Unexpected billing | Always Free shapes only (A1.Flex / E2.1.Micro); keep the $0.01 budget alert active as an early warning |

---

### Why this setup works for this bot

- `index.js` is a single long-running process; systemd keeps it alive and restarts it on crash
  (`Restart=always`) or VM reboot (the unit is `enable`d).
- `saver.js` flushes pending writes atomically on SIGINT/SIGTERM, so `systemctl restart` is
  always safe for the save data.
- Slash commands re-register automatically on every startup (guild-scoped when `guildId` is set
  in config), so no separate deploy step is needed.

