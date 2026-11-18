# Care Companion (PWA)

Elder-care companion app: Start button, voice AI chat (Qwen by default), medicine reminders,
SOS to caregivers, health tracking, mini games (color match, math, memory, patterns). English + Thai.

## Run
1. `ollama pull qwen2.5:7b` (and keep Ollama running)
2. `npm install`
3. `npm run dev` then open http://localhost:5173 (use `--host` URL on a tablet in the same Wi-Fi)
   - Production: `npm run build && npm start` (serves app + API on port 3001)

Staff alerts page: `/staff`. Settings (AI model, language, text size): `/settings`.
Voice input needs Chrome/Edge/Safari; microphone and install-as-app on a tablet need HTTPS or localhost.

## Switch AI model
Settings > Choose AI. Add API keys to `.env` (Gemini, OpenRouter, Groq, DashScope) to enable cloud models.
Add models in `server/ai/providers.ts`.

## Robot / ESP32
`server/robot/adapter.ts` defines the bridge. Set `ROBOT_MODE=websocket` and `ROBOT_WS_URL` in `.env`.
JSON protocol — app→robot: speak, move, face, led, stop. robot→app: sensor, button, battery, fall_detected.

## Screens
Start (design 1) -> Select Mode (design 2): Anti-loneliness (AI call, chat, games, family), Activity program (medicines, health), Contact assistant (SOS).
Design photos are cut from "medicare 01.jpg" / "medicare 02.jpg" into `public/hero.jpg` and `public/modes.jpg`.

## Family & Friends (messages + video calls)
Resident opens Anti-loneliness > Family & Friends, shares the invite link (`/join/CODE`). Family opens it on their phone, enters a name, then chats and video-calls.
Calls are peer-to-peer WebRTC; `server/index.ts` only relays messages and call setup over `/ws`.
- Camera/microphone work only on `https://` or `localhost`. For family on other phones, serve the app over HTTPS (e.g. a Cloudflare Tunnel or a hosted server).
- Only a public STUN server is configured; add a TURN server in `src/lib/room.tsx` if calls fail behind strict networks.

## Accounts and the administrator
- First start: open the app and sign in screen asks you to create the **administrator** account (password 8+ characters).
- The administrator (`/admin`) adds residents/administrators, sees who is online, medicines taken or missed, health readings,
  games and SOS alerts, resets passwords, disables or deletes accounts.
- Residents sign in once per device (stays signed in 30 days). Each person has their own local data on the device and
  reports medicines, health, games and SOS to the server so the admin can monitor them. Chat conversations are NOT shared with the admin.
- Accounts and activity are stored in `server/data/` (not uploaded to GitHub). Back this folder up.
- Passwords are hashed (scrypt); sign-in is rate limited. Use HTTPS when the app is reachable outside a trusted network.
