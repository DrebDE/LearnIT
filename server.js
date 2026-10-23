import express from 'express';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

const aiConfigured = () => Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY !== 'replace-me' && process.env.AI_MODEL && !process.env.AI_MODEL.startsWith('replace-'));
app.get('/api/status', (_req, res) => res.json({ configured: aiConfigured() }));
app.post('/api/extract', async (req, res) => {
  try {
    const { name, data } = req.body || {};
    if (!name || !data) return res.status(400).json({ error: 'Choose a file to extract.' });
    const buffer = Buffer.from(data, 'base64');
    const ext = path.extname(name).toLowerCase();
    let text = '';
    if (ext === '.txt') text = buffer.toString('utf8');
    else if (ext === '.pdf') {
      const result = await pdfParse(buffer, { pagerender: async page => {
        const content = await page.getTextContent();
        return `Page ${page.pageIndex + 1}: ${content.items.map(item => item.str).join(' ')}`;
      } });
      text = result.text;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === '.pptx') {
      const zip = await JSZip.loadAsync(buffer);
      const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/slide(\d+)/)?.[1])-Number(b.match(/slide(\d+)/)?.[1]));
      const pieces = [];
      for (const slide of slides) {
        const xml = await zip.files[slide].async('string');
        const parts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m => m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'"));
        if (parts.length) pieces.push(`${slide.replace(/^ppt\/slides\/slide/, 'Slide ').replace('.xml','')}: ${parts.join(' ')}`);
      }
      text = pieces.join('\n\n');
    } else return res.status(415).json({ error: 'Unsupported file. Upload PDF, DOCX, PPTX, or TXT.' });
    if (!text.trim()) return res.status(422).json({ error: 'No readable text could be extracted from this file.' });
    res.json({ text: text.slice(0, 120000), truncated: text.length > 120000 });
  } catch (e) { res.status(422).json({ error: `Could not extract text: ${e.message}` }); }
});
app.post('/api/ai', async (req, res) => {
  if (!aiConfigured()) return res.status(503).json({ error: 'AI features need setup. Copy .env.example to .env and set AI_API_KEY and AI_MODEL.' });
  try {
    const response = await fetch(`${(process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({ model: process.env.AI_MODEL, messages: req.body.messages, temperature: 0.3 })
    });
    const body = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: body.error?.message || 'AI provider request failed.' });
    res.json({ text: body.choices?.[0]?.message?.content || '' });
  } catch (e) { res.status(502).json({ error: `AI request failed: ${e.message}` }); }
});

app.listen(process.env.PORT || 3000, process.env.HOST || '127.0.0.1', () => console.log(`MedStudy is ready at http://localhost:${process.env.PORT || 3000}`));
