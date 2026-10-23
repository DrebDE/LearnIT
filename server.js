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
app.get('/api/config', (_req, res) => res.json({
  authConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
}));

const onlineLibraryCache = new Map();
const cacheMs = 10 * 60 * 1000;
let eutilsQueue = Promise.resolve();
let lastEutilsRequest = 0;
async function fetchEutils(url) {
  const task = eutilsQueue.then(async () => {
    const pause = Math.max(0, 400 - (Date.now() - lastEutilsRequest));
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
    lastEutilsRequest = Date.now();
    return fetch(url, { headers: { 'User-Agent': 'LearnIT student research search (NCBI E-utilities)' }, signal: AbortSignal.timeout(12000) });
  });
  eutilsQueue = task.then(() => undefined, () => undefined);
  return task;
}
async function searchEntrez(db, query, retmax = '6') {
  const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
  searchUrl.search = new URLSearchParams({ db, term: query, retmode: 'json', retmax, sort: 'relevance' }).toString();
  const searchResponse = await fetchEutils(searchUrl);
  if (!searchResponse.ok) throw new Error(`NCBI ${db} search returned ${searchResponse.status}`);
  const searchData = await searchResponse.json();
  const ids = searchData.esearchresult?.idlist || [];
  const count = Number(searchData.esearchresult?.count || 0);
  if (!ids.length) return { ids, count, summary: {} };
  const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
  summaryUrl.search = new URLSearchParams({ db, id: ids.join(','), retmode: 'json' }).toString();
  const summaryResponse = await fetchEutils(summaryUrl);
  if (!summaryResponse.ok) throw new Error(`NCBI ${db} summaries returned ${summaryResponse.status}`);
  const summaryData = await summaryResponse.json();
  return { ids, count, summary: summaryData.result || {} };
}
app.get('/api/search', async (req, res) => {
  const query = String(req.query.q || '').trim().replace(/[\u0000-\u001f]/g, '').slice(0, 180);
  if (query.length < 3) return res.status(400).json({ error: 'Enter at least 3 characters to search the online library.' });
  const cacheKey = query.toLowerCase();
  const cached = onlineLibraryCache.get(cacheKey);
  if (cached && Date.now() - cached.time < cacheMs) return res.json(cached.value);
  try {
    const settled = await Promise.allSettled([searchEntrez('books', query), searchEntrez('pubmed', query, '8')]);
    const [booksResult, papersResult] = settled;
    const topics = booksResult.status === 'fulfilled' ? booksResult.value.ids.map(uid => {
      const item = booksResult.value.summary[uid] || {};
      const authors = (item.authors || []).slice(0, 3).map(author => typeof author === 'string' ? author : author.name).filter(Boolean);
      const accession = item.bookaccession || item.uid || uid;
      return {
        uid,
        title: item.title || item.chapter || item.booktitle || 'NCBI Bookshelf topic',
        authors,
        source: item.booktitle || item.publisher || item.source || 'NCBI Bookshelf',
        year: String(item.pubdate || '').match(/\b(19|20)\d{2}\b/)?.[0] || '',
        url: `https://www.ncbi.nlm.nih.gov/books/${encodeURIComponent(accession)}/`
      };
    }) : [];
    const results = papersResult.status === 'fulfilled' ? papersResult.value.ids.map(pmid => {
      const item = papersResult.value.summary[pmid] || {};
      return {
        pmid,
        title: item.title || 'Untitled PubMed record',
        authors: (item.authors || []).slice(0, 3).map(author => author.name).filter(Boolean),
        journal: item.fulljournalname || item.source || '',
        year: String(item.pubdate || '').match(/\b(19|20)\d{2}\b/)?.[0] || '',
        url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`
      };
    }) : [];
    const value = {
      topics,
      results,
      errors: {
        bookshelf: booksResult.status === 'rejected' ? 'NCBI Bookshelf is unavailable right now.' : '',
        pubmed: papersResult.status === 'rejected' ? 'PubMed is unavailable right now.' : ''
      },
      counts: {
        topics: booksResult.status === 'fulfilled' ? booksResult.value.count : 0,
        papers: papersResult.status === 'fulfilled' ? papersResult.value.count : 0
      }
    };
    if (booksResult.status === 'rejected' && papersResult.status === 'rejected') throw new Error('NCBI search services are unavailable');
    onlineLibraryCache.set(cacheKey, { time: Date.now(), value });
    return res.json(value);
  } catch (error) {
    console.error('Online library search failed:', error.message);
    return res.status(502).json({ error: 'The online library is unavailable right now. Please try again shortly.' });
  }
});
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

app.listen(process.env.PORT || 3000, process.env.HOST || '127.0.0.1', () => console.log(`LearnIT is ready at http://localhost:${process.env.PORT || 3000}`));
