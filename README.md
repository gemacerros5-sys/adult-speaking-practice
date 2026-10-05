# SpeakBridge — corrected public version

This project preserves the downloaded Adult Speaking Practice interface, but removes the Gemini-preview-only injected scripts.

## What was corrected

- The microphone now uses the browser's own Web Speech API instead of Gemini's parent-frame permission bridge.
- Gemini requests go through `/api/gemini`, so the API key is kept on the server.
- Teacher access is verified on the server instead of exposing the teacher code in `index.html`.
- Shared unlocked-unit settings and student practice evidence are stored by the server.
- The original scenarios, interface, correction flow, Speaking Support, modes, themes and speech-speed controls remain in the app.

## Important

This is a full-stack app. Do not publish only `public/index.html` on GitHub Pages, because GitHub Pages cannot run `server.js`.

The public site must use HTTPS for microphone permission on phones and computers.

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Put your Gemini API key in `GEMINI_API_KEY`.
4. Set a strong `APP_SECRET`.
5. Install dependencies with `npm install`.
6. Start with `npm start`.
7. Open `http://localhost:3000`.

Node itself does not automatically load `.env`. For local testing, either export the variables in your terminal or run Node with an environment-file option supported by your Node version.

## Deploy

Use a host that can run a Node server (for example, a full-stack hosting service). Add these environment variables in the host's private settings:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `TEACHER_CODE`
- `APP_SECRET`

Never place the Gemini key directly in `public/index.html`.

## Storage note

The included server stores class settings and session evidence in JSON files so the project works without Firebase. On hosting platforms with ephemeral filesystems, use persistent storage or a database before relying on the records long-term.
