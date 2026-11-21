# Medicare — care companion for older adults

A web app (installable as a PWA) for care centers and homes. Residents sign in on a tablet and get:

- **AI friend** — chat or hands-free **voice conversation**, powered by **Qwen** running locally (no cloud, no per-use cost). English and Thai.
- **Medicine reminders** with a full-screen alarm and spoken prompt.
- **Health log** — blood pressure, sugar, sleep, mood, with warnings for out-of-range values.
- **SOS** — one big button that alerts the administrator.
- **Administrator dashboard** — the `admin` account sees every resident's condition (stable / needs a check / needs attention), medicines taken or missed, health readings and trends, games, SOS alerts, and can add residents and reset passwords.
- **Family & Friends** — message and video-call relatives who open an invite link.
- **Brain games** — colors, math, memory cards, patterns.
- Switchable AI models, optional robot (ESP32) link, iPad / Mac / phone layouts.

> **How it fits together:** one computer (a Mac, a PC or a **Raspberry Pi 5**) runs the **server**: the website, the AI (Ollama + Qwen) and the voice. Tablets and phones on the same Wi-Fi just open its address in a browser.

---

## Contents

1. [Requirements](#1-requirements)
2. [Run it on a Mac or PC (quick start)](#2-run-it-on-a-mac-or-pc-quick-start)
3. [Run it on a Raspberry Pi 5 with Ubuntu (step by step)](#3-run-it-on-a-raspberry-pi-5-with-ubuntu-step-by-step)
4. [Open it from an iPad or phone](#4-open-it-from-an-ipad-or-phone)
5. [Accounts, SOS and family video calls](#5-accounts-sos-and-family-video-calls)
6. [Settings (.env)](#6-settings-env)
7. [Updating and backups](#7-updating-and-backups)
8. [Troubleshooting](#8-troubleshooting)
9. [Robot / ESP32](#9-robot--esp32)
10. [Project layout](#10-project-layout)

---

## 1. Requirements

| | Minimum | Recommended |
|---|---|---|
| Server computer | any Mac/PC, or Raspberry Pi 5 (4 GB) | Raspberry Pi 5 **8 GB**, or a Mac with Apple Silicon |
| Node.js | 18 or newer | 22 LTS |
| AI runtime | [Ollama](https://ollama.com) | — |
| Browser on the tablet | Safari 15+ / Chrome | Chrome (for microphone input) |
| Network | tablets and server on the **same Wi-Fi** | a router with a fixed address for the server |

Voice **input** (the microphone) uses the browser's speech recognition. It works in **Chrome and Safari** on iPad, Mac, Android and Windows and needs internet. It does **not** work in the Chromium browser on a Raspberry Pi, so use the Pi as the server and open the app on an iPad / Mac / phone.

---

## 2. Run it on a Mac or PC (quick start)

```bash
# 1. get the code
git clone https://github.com/thun41934177/medi-care.git
cd medi-care

# 2. install the AI runtime and a model (Mac: brew install ollama, or download from ollama.com)
ollama pull qwen2.5:7b

# 3. install the app
npm install
cp .env.example .env

# 4a. development (auto-reloads)          -> open http://localhost:5173
npm run dev

# 4b. or the finished, faster build       -> open http://localhost:3001
npm run share
```

The terminal prints an address for other devices, for example `http://192.168.1.54:3001`.

---

## 3. Run it on a Raspberry Pi 5 with Ubuntu (step by step)

These steps turn a Pi 5 into a small always-on server for the whole care center. Everything is typed in a terminal on the Pi (directly, or over SSH).

> Written from the project's code and standard Ubuntu/Raspberry Pi procedures. If a step behaves differently on your Pi, see [Troubleshooting](#8-troubleshooting).

### What you need

- Raspberry Pi 5 — **8 GB** is best for the AI (4 GB works with the smaller models below)
- Official 27 W USB-C power supply and the Raspberry Pi **Active Cooler** (the AI keeps the CPU busy)
- microSD card (32 GB or more, A2 rated) **or** an NVMe SSD (faster, recommended)
- Ethernet cable or Wi-Fi, and a way to see the Pi: monitor + keyboard, or SSH from another computer

### Step 1 — Install Ubuntu on the Pi

1. On your computer, install **Raspberry Pi Imager** from raspberrypi.com/software.
2. Choose **Raspberry Pi 5**, then **Other general-purpose OS → Ubuntu → Ubuntu Server 24.04 LTS (64-bit)**.
3. Click the gear / **Edit settings** and set: a hostname (for example `medicare`), a username and password, your Wi-Fi (if not using Ethernet), your time zone, and **enable SSH**.
4. Write the card, put it in the Pi, and power it on. Wait about two minutes.
5. From your computer, connect: `ssh <username>@medicare.local` (or use the Pi's IP address).

### Step 2 — Update the system

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

Reconnect after about a minute. Then check the time zone (used for log times):

```bash
timedatectl            # shows the current time zone
sudo timedatectl set-timezone Asia/Bangkok    # change if needed
```

### Step 3 — Install Node.js, Git and the voice

```bash
sudo apt install -y git curl ca-certificates espeak-ng avahi-daemon
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v      # should print v22.x and 10.x
```

- `espeak-ng` gives the server an offline **Thai and English voice**.
- `avahi-daemon` lets tablets use `http://medicare.local:3001` instead of a number.

### Step 4 — Install Ollama and a Qwen model

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

(If it complains about `zstd`, run `sudo apt install -y zstd` and repeat.) Ollama starts automatically as a service.

Pick a model that fits your Pi. **Smaller is faster**; for a voice conversation the speed matters:

| Pi 5 memory | Model | Command | Feel |
|---|---|---|---|
| 8 GB | **qwen2.5:3b** (recommended) | `ollama pull qwen2.5:3b` | good answers, usable speed |
| 8 GB | qwen2.5:7b | `ollama pull qwen2.5:7b` | best answers, **slow** on a Pi |
| 4 GB | qwen2.5:1.5b | `ollama pull qwen2.5:1.5b` | fastest, simpler answers |

Test it (type `/bye` to leave):

```bash
ollama run qwen2.5:3b "Say hello in Thai"
```

### Step 5 — Download and install the app

```bash
cd ~
git clone https://github.com/thun41934177/medi-care.git
cd medi-care
npm install
cp .env.example .env
nano .env
```

In `.env`, set the model you pulled (use the exact name from Step 4) and a password for the administrator account (8+ characters), for example:

```
QWEN_MODEL=qwen2.5:3b
ADMIN_PASSWORD=choose-a-strong-password
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`. Leave everything else as it is.

### Step 6 — Build and try it

```bash
npm run build          # takes a minute or two on a Pi
npm start
```

You should see lines like:

```
API on http://localhost:3001
Other devices on this network (iPad, phone): http://192.168.1.60:3001
```

On an iPad or Mac on the same Wi-Fi, open that address (or `http://medicare.local:3001`). You should see the Medicare start screen. Press `Ctrl+C` to stop it, then continue so it starts by itself.

### Step 7 — Start automatically at boot (systemd)

Replace `ubuntu` below with your username if it is different.

```bash
sudo nano /etc/systemd/system/medicare.service
```

Paste:

```ini
[Unit]
Description=Medicare care companion
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/medi-care
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now medicare
systemctl status medicare          # should say: active (running)
```

Useful commands: `journalctl -u medicare -f` (live log), `sudo systemctl restart medicare`, `sudo systemctl stop medicare`.

### Step 8 — Firewall and a stable address

- If the firewall is on (`sudo ufw status` says *active*): `sudo ufw allow 3001/tcp`
- In your **router**, give the Pi a fixed address (a "DHCP reservation"), so the address never changes. Find it with `hostname -I`.
- Check it from the Pi: `curl -s http://localhost:3001/api/auth/me` should print `{"error":"login"}`. That means the server is up.

### Step 9 — First use

1. On the iPad, open `http://<pi-address>:3001` (or `http://medicare.local:3001`).
2. Tap **Get Started** and sign in as **`admin`** with the `ADMIN_PASSWORD` you set. You land on the administrator dashboard. Change the password there.
3. Sign out, then **Create account** as a resident and try **Talk to AI** and **Call AI friend**. Back as `admin` you will see that resident on the dashboard.

Your Pi is now the care center's server. See [section 4](#4-open-it-from-an-ipad-or-phone) for tablets and [section 5](#5-accounts-sos-and-family-video-calls) for accounts.

### Raspberry Pi notes

- **Speed.** The AI runs on the Pi's CPU. The first answer after a pause can take several seconds (the model loads into memory). Smaller models answer much faster. Keep the Pi cool and use a good power supply.
- **Voice.** On Linux the server uses `espeak-ng`: clear and offline, but more robotic than a Mac voice. On iPad/Mac the app can use the device's own voice instead: *Settings → AI voice → Voice source → Browser voice*.
- **Memory.** Run only one model at a time. Check with `ollama ps`, free memory with `free -h`.
- **Storage.** Models live in `~/.ollama` (`qwen2.5:3b` ≈ 2 GB, `7b` ≈ 4.7 GB).

---

## 4. Open it from an iPad or phone

1. The tablet and the server must be on the **same Wi-Fi**.
2. In Safari or Chrome type the address **by hand**: `http://<server-address>:3001`. Always start with `http://` (not `https://`).
3. The address is shown on the server's terminal, and in the app under **Settings → Open on an iPad or phone**.
4. Optional: tap Share → **Add to Home Screen** so it opens like an app.

`localhost` only works on the computer that runs the server. The address changes if the server moves to another Wi-Fi, so give a Raspberry Pi / server a fixed address in the router.

**Camera and microphone over plain `http://`:** browsers only allow the camera on `https://` or `localhost`, so **family video calls need HTTPS**. Chat messages, the AI, medicine reminders and SOS all work over `http://`. (Serving the app over HTTPS, for example behind a reverse proxy such as Caddy with a trusted certificate, enables video.)

---

## 5. Accounts, administrator, SOS and family video calls

- **Residents.** Anyone can **Create account** on the sign-in screen (username, password of 4+ characters, optional room). Devices stay signed in for 30 days. Passwords are hashed; sign-in and sign-up are rate limited. **Open sign-up** means anyone who can reach the server can make a resident account, so run it on a trusted network.
- **Administrator.** The one account with the username **`admin`** opens the administrator screens (`/admin`) after signing in; nobody else can open them, and nobody can sign up as `admin`. It is created on first start from `ADMIN_PASSWORD` in `.env` (8+ characters). **Change the password after the first sign-in** (admin dashboard → *Your account*). The dashboard warns you while the password is easy to guess.
- **What the administrator sees.** A resident's device reports their medicine schedule, doses taken, health readings, game scores and when they were last online. The dashboard sorts residents by condition:
  - **Needs attention** — an SOS is open, or the latest reading is out of range (blood pressure ≥160 top or <90, ≥100 or <55 bottom; sugar ≥250 or <70 mg/dL; sleep <3 h). Please have a nurse confirm these limits.
  - **Needs a check** — a medicine is missed today, or the latest mood is "sad".
  - **Stable** — none of the above.
  Click **View** for one resident: latest readings, blood pressure and sugar trends, medicine schedule with today's status, reading history, games, SOS history, reset password, delete.
- **Chats are private.** What a resident says to the AI is not stored on the server and the administrator cannot read it.
- **Residents' data** also stays on their own device. Each person has a separate local store on a shared tablet.
- **SOS.** Pressing SOS saves an alert on the server. The administrator sees it at the top of the dashboard and taps **Acknowledge**. An optional webhook can forward it (`SOS_WEBHOOK_URL`).
- **Family & Friends.** Under *Anti-loneliness → Family & Friends* the resident gets an invite link. Relatives open it on their phone, type their name and can message and video-call. They do **not** need an account (see the HTTPS note above for video).

## 6. Settings (.env)

Copy `.env.example` to `.env` and edit. Restart the server after changes.

| Setting | What it does |
|---|---|
| `PORT` | port the app listens on (default `3001`) |
| `ADMIN_PASSWORD` | password for the `admin` account, used only when it is first created (8+ characters) |
| `DEFAULT_PROVIDER` | which AI answers by default (`qwen-local`) |
| `QWEN_MODEL` | the Ollama model for Qwen, e.g. `qwen2.5:3b` |
| `OLLAMA_URL` | where Ollama runs (default `http://localhost:11434/v1`) |
| `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `DASHSCOPE_API_KEY` | optional cloud models (they appear in *Settings → Choose AI* once a key is set; these send conversations to that provider) |
| `SOS_WEBHOOK_URL` | forward SOS alerts to Slack/another service |
| `ROBOT_MODE`, `ROBOT_WS_URL` | robot bridge (see section 9) |

Other models can be added in `server/ai/providers.ts`.

---

## 7. Updating and backups

**Update to the newest code** (on the server):

```bash
cd ~/medi-care
git pull
npm install
npm run build
sudo systemctl restart medicare      # on a Pi; on a Mac just stop and run `npm run share` again
```

**Back up** the folder `server/data/` (accounts, saved sign-ins, SOS alerts, family chats). It is not stored in Git:

```bash
tar czf medicare-backup-$(date +%F).tar.gz server/data
```

---

## 8. Troubleshooting

| Problem | What to check |
|---|---|
| iPad: "Safari can't open the page" | Same Wi-Fi as the server? Typed `http://` (not https) and `:3001`? Server awake and running (`systemctl status medicare`)? Firewall open (`sudo ufw allow 3001/tcp`)? The address changed? Check Settings in the app. Turn off VPN / iCloud Private Relay on the iPad. |
| Test from the iPad | Open `http://<address>:3001/api/auth/me`. It should show `{"error":"login"}`. If that loads, the server is fine. |
| A Mac that goes to sleep | The server disappears when the Mac sleeps. Keep it awake (`caffeinate -di`) or use the Pi. |
| "AI is not available" | `ollama list` shows your model? `QWEN_MODEL` in `.env` matches it exactly? Ollama running (`systemctl status ollama`)? |
| AI is very slow on the Pi | Use a smaller model (`qwen2.5:3b` or `1.5b`), set `QWEN_MODEL`, restart. Check cooling and power. |
| No Thai/English voice from the server | Linux: `sudo apt install espeak-ng` then restart. Mac: voices come from System Settings → Accessibility → Spoken Content. |
| Microphone / voice input does not work | Use Chrome or Safari on the tablet and allow the microphone. It needs internet. It does not work in Chromium on the Pi. |
| Video call fails | Needs HTTPS (see section 4). Both people must allow camera and microphone. |
| Forgot a resident's password | Sign in as `admin`, open the resident, and set a new password. |
| Forgot the admin password | Stop the server, delete the `admin` entry in `server/data/users.json`, set `ADMIN_PASSWORD` in `.env`, start the server (it recreates `admin`). |
| See what is happening | `journalctl -u medicare -f` shows the log, including a `[visit]` line whenever a new device opens the app. |

---

## 9. Robot / ESP32

`server/robot/adapter.ts` is a hardware-neutral bridge. By default it only logs commands (`ROBOT_MODE=mock`). To talk to an ESP32 (or any board) that runs a WebSocket server, set in `.env`:

```
ROBOT_MODE=websocket
ROBOT_WS_URL=ws://192.168.1.50:81
```

JSON messages — app to robot: `speak`, `move`, `face`, `led`, `stop`; robot to app: `sensor`, `button`, `battery`, `fall_detected` (a fall or the robot's SOS button raises a normal SOS alert).

---

## 10. Project layout

```
server/
  index.ts          web server, AI chat (+ streaming), SOS, family chat/call signalling
  auth.ts           sign up / sign in / sessions
  admin.ts          administrator dashboard data, resident activity reporting
  activity.ts       SOS alert storage
  tts.ts            offline voice (macOS `say`, Linux `espeak-ng`)
  ai/providers.ts   AI models (Qwen via Ollama, optional cloud models)
  robot/adapter.ts  robot bridge
  data/             accounts, sessions, alerts (created at run time, not in Git)
src/
  pages/            Start, Login, Select Mode, Chat, Live call, Meds, Health, Games, Family, SOS, Settings, Admin, AdminUser
  components/       Sidebar, banner, icons, call screen, ...
  lib/              speech (voices), auth, family room / WebRTC
  games/            the four brain games
public/             images, icons
```

Scripts: `npm run dev` (development), `npm run build`, `npm start` (serve the built app + API), `npm run share` (build + start).
