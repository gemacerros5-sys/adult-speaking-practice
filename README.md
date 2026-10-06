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


## Feedback V2
This update keeps the existing design and microphone, but changes the tutor logic:
- Units 1–12 start directly in their scenario.
- Guided Practice checks the learner before moving on.
- Important errors trigger correction + retry.
- The AI must answer relevant learner questions before continuing.
- Generic unrelated replies were removed from the offline fallback.
- Teacher session listing is protected by teacher authentication.


## Tutor V3
This version removes fake conversational fallback responses. If Gemini is unavailable, the UI says so instead of pretending to continue. `/api/ai-test` safely verifies the real Gemini connection without exposing the API key. Guided Practice now uses Gemini for adaptive correction, retry, and scenario continuation across all units.


## Final feedback build
This build ports the adaptive correction behavior from the earlier Gemini-hosted version into the Render full-stack architecture. It preserves microphone handling, pauses Guided Practice for a correction retry, resumes the same scenario after an acceptable retry, and avoids fake generic fallback conversations.

Render environment:
- GEMINI_API_KEY = your private key
- GEMINI_MODEL = gemini-3-flash-preview
- TEACHER_CODE = 121705
- APP_SECRET = private random secret

After deployment, open `/api/ai-test`. A healthy AI connection should return `"ok":true` and a response containing `TUTOR_OK`.


## Stability update (automatic retry)
- Keeps the existing adaptive tutor prompt and correction behavior.
- Adds up to 2 automatic retries after the original request for transient Gemini/network failures.
- Keeps the learner on the same turn while retrying.
- Prevents duplicate microphone submissions while AI is processing.
- Shows the existing Thinking... state during processing.
- Only shows the unavailable message after all retry attempts fail.


## Gemini 3.8 Live edition
This build uses Gemini 3.8 Live for learner speaking turns. The browser requests a short-lived ephemeral token from `/api/live-token`, then streams microphone PCM audio directly to Gemini over WebSocket. The long-lived `GEMINI_API_KEY` remains only on Render.

Important: keep the existing `GEMINI_API_KEY`, `TEACHER_CODE`, and `APP_SECRET` environment variables. `GEMINI_MODEL` may remain present for the legacy `/api/gemini` diagnostic route; Live sessions explicitly use `gemini-3.8-live`.

Mic behavior: tap once to start speaking; tap again when finished.
