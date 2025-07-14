const express = require('express');
const { v4: uuid } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

const PORT = process.env.PORT || 10000;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

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
    const voiceId = '21m00Tcm4TlvDq8ikWAM'; // default voice
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
        .input('color=c=black:s=1080x1920:d=10') // 10‑s black video
        .input(audioPath)
        .outputOptions('-shortest')
        .output(videoPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    jobs[id].progress = 100;
    jobs[id].status = 'completed';
    jobs[id].url = `/downloads/${id}.mp4`;

    // move to public folder
    const downloadsDir = path.join(__dirname, '..', 'web', 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });
    fs.copyFileSync(videoPath, path.join(downloadsDir, `${id}.mp4`));
  } catch (err) {
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
