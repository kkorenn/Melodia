# Melodia

Self-hosted, single-user music streaming app. Melodia scans your local music folder, caches metadata in SQLite, and streams audio locally with instant seek.

## Requirements

- Node.js: **22 LTS recommended** (Node 20 LTS supported)
- npm: **10+**
- OS: macOS, Linux, or Windows

Notes:
- `better-sqlite3` is native; some machines need compiler/build tools.

## Quick Start (Recommended)

After cloning the repo, run:

```bash
npm run setup
```

Then open `.env`, set `MUSIC_DIR` to your absolute music folder path, and start:

```bash
npm run dev
```

If you only want production-style hosting:

```bash
npm run build
npm --prefix server run start
```

## 1) Install Prerequisites

### macOS

1. Install Node.js 22 LTS (or 20 LTS)
2. Install Apple CLI tools if needed:

```bash
xcode-select --install
```

### Linux

1. Install Node.js 22 LTS (or 20 LTS)
2. Install build tools if native modules need compiling

Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y build-essential python3 make g++
```

Fedora/RHEL:
```bash
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y python3 make gcc-c++
```

Arch:
```bash
sudo pacman -S --needed base-devel python
```

### Windows

1. Install Node.js 22 LTS (or 20 LTS)
2. If needed, install Visual Studio Build Tools (C++ workload)
3. Use PowerShell or CMD for commands

## 2) Configure Environment

`npm run setup` creates `.env` from `.env.example` automatically if missing.

Copy `.env.example` to `.env`:

macOS/Linux:
```bash
cp .env.example .env
```

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

Set `.env` values:

```ini
MUSIC_DIR=/absolute/path/to/your/music
PORT=4872
DB_PATH=./server/data/melodia.sqlite
AUTO_OPEN_BROWSER=true
LYRICS_CACHE_TTL_HOURS=24
SETTINGS_PASSWORD_HASH=
SETTINGS_PASSWORD=
SETTINGS_AUTH_RATE_LIMIT_MS=5000
SETTINGS_AUTH_SESSION_HOURS=12
SETTINGS_AUTH_SECURE_COOKIE=false
```

Required:
- `MUSIC_DIR`: absolute path to your music folder
- `PORT`: change if 4872 is in use

Optional:
- `AUTO_OPEN_BROWSER=false`: for headless/server mode
- `SETTINGS_PASSWORD_HASH`: secure password hash for protecting Settings endpoints
- `SETTINGS_PASSWORD`: plain password fallback (use only if hash is not set)
- `SETTINGS_AUTH_RATE_LIMIT_MS`: login throttle window (default `5000`)
- `SETTINGS_AUTH_SESSION_HOURS`: settings session duration (default `12`)
- `SETTINGS_AUTH_SECURE_COOKIE=true`: recommended when exposing through HTTPS tunnel/domain

## Settings Password Lock (Recommended for tunnels)

Melodia can lock Settings and rescan controls behind backend password auth.

1. Generate a secure hash:
```bash
npm run settings:hash -- "your-very-strong-password"
```
2. Copy the printed `SETTINGS_PASSWORD_HASH=...` line into `.env`.
3. For Cloudflared/public HTTPS domains, set:
```ini
SETTINGS_AUTH_SECURE_COOKIE=true
```
4. Restart the server.

Behavior:
- `/api/settings`, `/api/settings` (POST), and `/api/rescan` require auth.
- Playlist write APIs also require auth:
  - create/rename/delete playlist
  - add/remove songs
  - sort playlist
  - set/clear playlist cover
- Login is rate-limited to 1 attempt per 5 seconds per IP by default.
- Password verification is backend-side only (never in URL/query string).

## 3) Install Dependencies

```bash
npm install
```

## 4) Run Melodia

Development (server + frontend dev):

```bash
npm run dev
```

or

```bash
npm start
```

Production-style hosting (build client, serve via Express):

```bash
npm run build
npm --prefix server run start
```

## Access URLs

- Dev frontend: `http://localhost:5173`
- API/server: `http://localhost:4872`
- LAN access (phone/tablet): `http://<your-local-ip>:<PORT>`

## Mobile Web Usage

Melodia supports mobile browsers through the same frontend.

1. Start server in host mode:
```bash
npm run build
npm --prefix server run start
```
2. On your phone (same Wi-Fi), open:
- `http://<your-local-ip>:4872`

## Script Files

All shell/batch wrappers delegate to one shared cross-platform runner: `scripts/cli.js`.

### macOS/Linux (`.sh`)

```bash
./scripts/setup.sh
./scripts/run.sh
./scripts/build.sh
./scripts/host.sh
./scripts/release-reset.sh
```

### Windows (`.bat`)

```bat
scripts\setup.bat
scripts\run.bat
scripts\build.bat
scripts\host.bat
scripts\release-reset.bat
```

What they do:
- `setup`: checks Node/npm, creates `.env` if missing, runs `npm install`
- `run`: development mode
- `build`: builds server/client
- `host`: serves app/API through backend
- `release-reset`: removes local/private/runtime files for repo publishing

## npm Commands

- `npm run setup`: setup helper (same as `scripts/setup.*`)
- `npm run run`: start development mode
- `npm run dev`: run server + client dev
- `npm run build`: build server/client
- `npm run host`: serve production build from backend
- `npm run release:reset`: wipe local/private/runtime files (asks for confirmation)
- `npm run release:reset:yes`: same reset without confirmation prompt
- `npm start`: alias to `npm run dev`
- `npm run lint`: run project lint checks
- `npm run test`: run backend unit tests
- `npm --prefix server run start`: run backend host mode

## Troubleshooting

### `404` for `/api/*` when using `npx serve dist`

Expected. `serve dist` only hosts static files and does not run Melodia API.

Use:
```bash
npm run build
npm --prefix server run start
```

### Port already in use

Change `PORT` in `.env`, then restart.

### No songs showing

- Verify `MUSIC_DIR` is correct and absolute
- Run **Rescan Library** in Settings

### `npm install` fails on `better-sqlite3`

Install OS build tools from prerequisites, then retry `npm install`.

## Legal Notice

Melodia is software only. It does not grant rights to any music or media files.

- You are responsible for ensuring you have legal rights to store, scan, and stream any content used with this app.
- Do not use Melodia to distribute copyrighted media without permission.

## Scope

- Single-user
- No user accounts or multi-user auth
- Optional Settings password lock for administrative actions
- Intended for trusted local/home network
