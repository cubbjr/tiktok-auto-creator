# TikTok Auto Creator – Flattened Starter

Upload this repository as‑is to GitHub (root contains Dockerfile, render.yaml, src/, web/).

## Deploy

1. **Create repo:** new GitHub repo → upload everything in this ZIP.<br>
2. **Render:** create new Web Service from repo → set `ELEVENLABS_API_KEY` env var.<br>
3. Wait ~3 min, open onrender.com URL, paste text, hit **Create video!**

The code uses ElevenLabs TTS + FFmpeg (pre‑installed in Dockerfile) to synthesize a 10‑second vertical MP4 with black background.

_This is a minimal demo; swap in gameplay footage, add S3 upload, etc. when you’re ready._
