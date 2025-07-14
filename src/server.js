const express = require('express');
const { v4: uuid } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

const PORT = process.env.PORT || 10000;

/* ────────────── ELEVENLABS key: read, trim, debug ────────────── */
const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY || '').trim();

console.log('ELEVEN key literal:', JSON.stringify(ELEVENLABS_API_KEY));
console.log('ELEVEN key length :', ELEVENLABS_API_KEY.length);
console.log(
  'ELEVEN key first 8  :',
  ELEVENLABS_API_KEY ? ELEVENLABS_API_KEY.slice(0, 8) + '…' : '(undefined)'
);

if (!ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not set in the container!');
}

/* one-off live test – lists voices so you know the key is accepted.
   Comment this whole IIFE out after troubleshooting. */
(async () => {
  try {
    const r = await axios.get(
      'https://api.elevenlabs.io/v1/voices',
      { headers: { 'xi-api-key': ELEVENLABS_API_KEY } }
    );
    console.log('Voice list status:', r.status);   // expect 200
  } catch (e) {
    console.error(
      'Voice list failed:',
      e.response?.status,
      e.response?.data?.detail || e.message
    );
  }
})();
/* ─────────────────────────────────────────────────────────────── */

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'web')));

// in‑memory job store (for demo only)
const jobs = {};

app.post('/api/jobs', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text field required' });
  }
  const id = uuid();
  jobs[id] = { id, progress: 0, status: 'queued' };
  res.json({ id });

  // async worker imitation
  try {
    jobs[id].status = 'processing';
    jobs[id].progress = 10;

    // --- generate TTS ---
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY missing');
    }
    const voiceId = 'AZnzlk1XvdvUeBnXmlld';
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const ttsResp = await axios.post(ttsUrl,
      { text, voice_settings: { stability: 0.3, similarity_boost: 0.3 } },
      { headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
    );
    const audioPath = path.join('/tmp', `${id}.mp3`);
    fs.writeFileSync(audioPath, ttsResp.data);
    jobs[id].progress = 50;

    // --- render simple video (black bg) ---
    const videoPath = path.join('/tmp', `${id}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg()
        // synthetic 1080×1920, 25 fps, 10-second black clip
        .input('color=black:size=1080x1920:r=25:d=10')
        .inputFormat('lavfi')          // tells FFmpeg the previous input is a filter

        // voice-over audio
        .input(audioPath)

        // stop when either stream ends (audio is ~2 s)
        .outputOptions([
          '-shortest',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p'
        ])

        .output(videoPath)

        // optional debug logs
        .on('start',  cmd  => console.log('FFmpeg cmd:', cmd))
        .on('stderr', line => console.log('FFmpeg:', line))

        .on('end',   resolve)
        .on('error', reject)
        .run();
    });

    jobs[id].progress = 100;
    jobs[id].status   = 'completed';
    jobs[id].url      = `/downloads/${id}.mp4`;

    // move to public folder
    const downloadsDir = path.join(__dirname, '..', 'web', 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });
    fs.copyFileSync(videoPath, path.join(downloadsDir, `${id}.mp4`));
  }
  catch (err) {
    console.error(err);
    jobs[id].status = 'error';
    jobs[id].error = err.message;
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
