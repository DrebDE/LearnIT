import express from 'express';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '100mb' }));
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
const fieldSearchProfiles = {
  MLS: {
    search: ['medical laboratory science', 'medical technology', 'clinical laboratory', 'laboratory medicine', 'laboratory diagnosis', 'diagnostic testing', 'hematology', 'transfusion', 'blood bank', 'clinical chemistry', 'immunohematology'],
    relevant: ['laborator', 'diagnostic', 'test', 'assay', 'specimen', 'transfusion', 'blood bank', 'blood cell', 'cell count', 'morphology', 'coagulation', 'clinical chemistry', 'cytolog', 'histopatholog', 'microbiolog', 'urinalysis', 'serology', 'quality control', 'hemoglobin', 'haemoglobin']
  },
  Nursing: {
    search: ['nursing', 'nursing care', 'patient care', 'nursing practice', 'nursing education', 'nursing assessment', 'nursing intervention', 'clinical nursing'],
    relevant: ['nurs', 'patient care', 'care delivery', 'clinical practice', 'nursing education', 'nursing assessment', 'nursing intervention', 'medication safety', 'therapeutic communication', 'nursing research']
  },
  Psychology: {
    search: ['psychology', 'psychological', 'cognitive', 'behavior', 'behaviour', 'psychometrics', 'psychotherapy', 'mental health', 'developmental psychology'],
    relevant: ['psycholog', 'cognitive', 'behavior', 'behaviour', 'mental health', 'psychometric', 'personality', 'psychotherapy', 'developmental', 'learning', 'memory', 'social psychology', 'neuropsych']
  },
  Pharmacy: {
    search: ['pharmacy', 'pharmacist', 'pharmaceutical', 'pharmacology', 'pharmacotherapy', 'pharmaceutics', 'medication safety', 'clinical pharmacy', 'drug discovery'],
    relevant: ['pharmac', 'medicine', 'medication', 'drug', 'pharmaceutical', 'dispensing', 'pharmacotherapy', 'pharmaceutics', 'pharmacognosy', 'pharmacology', 'toxicology', 'dosage form', 'medicinal chemistry', 'pharmacy practice', 'pharmacy law']
  }
};
function scopedQuery(query, fields, db) {
  const profileTerms = [...new Set(fields.flatMap(field => fieldSearchProfiles[field]?.search || []))];
  if (!profileTerms.length) return query;
  const tag = db === 'pubmed' ? '[Title/Abstract]' : '';
  const topic = db === 'pubmed' && /\s/.test(query) ? `"${query}"${tag}` : `${query}${tag}`;
  const context = profileTerms.map(term => `"${term}"${tag}`).join(' OR ');
  return `(${topic}) AND (${context})`;
}
function normalizeSearchText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function matchesQuery(item, query) {
  const documentText = normalizeSearchText([item.title, item.snippet, item.venue].join(' '));
  const stopWords = new Set(['and', 'the', 'for', 'with', 'from', 'into', 'about', 'what', 'how', 'why', 'theory', 'study', 'studies', 'basic', 'basics', 'introduction']);
  const terms = normalizeSearchText(query).split(/\s+/).filter(term => term.length > 2 && !stopWords.has(term));
  if (!terms.length) return true;
  const hits = terms.filter(term => documentText.includes(term) || (term.endsWith('y') && documentText.includes(term.slice(0, -1))));
  const title = normalizeSearchText(item.title);
  const exactTitlePhrase = title.includes(normalizeSearchText(query));
  return exactTitlePhrase || hits.length === terms.length;
}
function matchesField(item, field) {
  const documentText = normalizeSearchText([item.title, item.snippet, item.venue, item.provider, item.type].join(' '));
  return (fieldSearchProfiles[field]?.relevant || []).some(term => documentText.includes(normalizeSearchText(term)));
}
function filterRelevantResults(results, query, fields) {
  return results.filter(item => matchesQuery(item, query) && (!fields.length || fields.some(field => matchesField(item, field))));
}
async function searchEntrez(db, query, retmax = '6', fields = []) {
  const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
  searchUrl.search = new URLSearchParams({ db, term: scopedQuery(query, fields, db), retmode: 'json', retmax, sort: 'relevance' }).toString();
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
function cleanAbstract(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 420);
}
async function searchEuropePmc(query, fields = []) {
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.search = new URLSearchParams({ query: scopedQuery(query, fields, 'europepmc'), format: 'json', pageSize: '8', resultType: 'core', sort: 'P_PDATE_D' }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': 'LearnIT student research search' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Europe PMC returned ${response.status}`);
  const data = await response.json();
  const rows = data.resultList?.result || [];
  return { count: Number(data.hitCount || 0), results: rows.map(item => {
    const pmid = item.pmid || (item.source === 'MED' ? item.id : '');
    const pmcid = item.pmcid || '';
    const doi = item.doi || '';
    const fullText = item.isOpenAccess === 'Y' ? item.fullTextUrlList?.fullTextUrl?.find(link => /^https:\/\//i.test(link.url || ''))?.url || '' : '';
    const url = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/` : pmcid ? `https://europepmc.org/articles/${encodeURIComponent(pmcid)}` : doi ? `https://doi.org/${encodeURIComponent(doi)}` : `https://europepmc.org/search?query=${encodeURIComponent(query)}`;
    return { id: `epmc-${item.source || 'record'}-${item.id}`, title: item.title || 'Untitled Europe PMC record', authors: String(item.authorString || '').split(',').map(author => author.trim()).filter(Boolean).slice(0, 3), venue: item.journalTitle || item.bookOrReportDetails?.publisher || '', year: item.pubYear || '', url, fullText, doi, snippet: cleanAbstract(item.abstractText), provider: 'Europe PMC', type: pmcid && item.isOpenAccess === 'Y' ? 'Open-access article' : 'Research article' };
  }) };
}
async function searchCrossref(query) {
  const url = new URL('https://api.crossref.org/works');
  url.search = new URLSearchParams({ 'query.bibliographic': query, rows: '8', select: 'DOI,title,author,container-title,published,created,type,URL,abstract' }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': 'LearnIT student literature search (https://github.com/DrebDE/LearnIT)' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Crossref returned ${response.status}`);
  const data = await response.json();
  const rows = data.message?.items || [];
  return { count: Number(data.message?.['total-results'] || 0), results: rows.map(item => {
    const doi = item.DOI || '';
    const date = item.published?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || '';
    const title = Array.isArray(item.title) ? item.title[0] : item.title;
    const authors = (item.author || []).slice(0, 3).map(author => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean);
    const url = doi ? `https://doi.org/${encodeURIComponent(doi)}` : (/^https:\/\//i.test(item.URL || '') ? item.URL : '');
    return { id: `crossref-${doi || title || Math.random()}`, title: title || 'Untitled scholarly work', authors, venue: (item['container-title'] || [])[0] || item.publisher || '', year: String(date || ''), url, fullText: '', doi, snippet: cleanAbstract(item.abstract), provider: 'Crossref', type: item.type === 'book' || item.type === 'book-chapter' ? 'Book or chapter' : 'Scholarly work' };
  }).filter(item => item.url) };
}
app.get('/api/search', async (req, res) => {
  const query = String(req.query.q || '').trim().replace(/[\u0000-\u001f]/g, '').slice(0, 180);
  if (query.length < 2) return res.status(400).json({ error: 'Enter at least 2 characters to search the online library.' });
  const requestedFields = String(req.query.fields || '').split(',').map(field => field.trim()).filter(field => field in fieldSearchProfiles);
  const fields = [...new Set(requestedFields)];
  const cacheKey = `${fields.slice().sort().join(',')}|${query.toLowerCase()}`;
  const cached = onlineLibraryCache.get(cacheKey);
  if (cached && Date.now() - cached.time < cacheMs) return res.json(cached.value);
  try {
    const settled = await Promise.allSettled([searchEntrez('books', query, '8', fields), searchEntrez('pubmed', query, '8', fields), searchEuropePmc(query, fields), searchCrossref(query)]);
    const [booksResult, papersResult, europeResult, crossrefResult] = settled;
    const books = booksResult.status === 'fulfilled' ? booksResult.value.ids.map(uid => {
      const item = booksResult.value.summary[uid] || {};
      const authors = (item.authors || []).slice(0, 3).map(author => typeof author === 'string' ? author : author.name).filter(Boolean);
      const accession = item.bookaccession || item.uid || uid;
      return {
        id: `book-${uid}`,
        title: item.title || item.chapter || item.booktitle || 'NCBI Bookshelf topic',
        authors,
        venue: item.booktitle || item.publisher || item.source || 'NCBI Bookshelf',
        year: String(item.pubdate || '').match(/\b(19|20)\d{2}\b/)?.[0] || '',
        url: `https://www.ncbi.nlm.nih.gov/books/${encodeURIComponent(accession)}/`,
        fullText: `https://www.ncbi.nlm.nih.gov/books/${encodeURIComponent(accession)}/`,
        doi: '', snippet: '', provider: 'NCBI Bookshelf', type: 'Open textbook chapter'
      };
    }) : [];
    const pubmed = papersResult.status === 'fulfilled' ? papersResult.value.ids.map(pmid => {
      const item = papersResult.value.summary[pmid] || {};
      return {
        id: `pubmed-${pmid}`,
        title: item.title || 'Untitled PubMed record',
        authors: (item.authors || []).slice(0, 3).map(author => author.name).filter(Boolean),
        venue: item.fulljournalname || item.source || '',
        year: String(item.pubdate || '').match(/\b(19|20)\d{2}\b/)?.[0] || '',
        url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`,
        fullText: '', doi: '', snippet: '', provider: 'PubMed', type: 'Research article'
      };
    }) : [];
    const results = filterRelevantResults([...books, ...(europeResult.status === 'fulfilled' ? europeResult.value.results : []), ...pubmed, ...(crossrefResult.status === 'fulfilled' ? crossrefResult.value.results : [])], query, fields);
    const value = {
      results,
      fields,
      errors: {
        bookshelf: booksResult.status === 'rejected' ? 'NCBI Bookshelf is unavailable right now.' : '',
        pubmed: papersResult.status === 'rejected' ? 'PubMed is unavailable right now.' : '',
        europepmc: europeResult.status === 'rejected' ? 'Europe PMC is unavailable right now.' : '',
        crossref: crossrefResult.status === 'rejected' ? 'Crossref is unavailable right now.' : ''
      },
      counts: {
        bookshelf: booksResult.status === 'fulfilled' ? booksResult.value.count : null,
        pubmed: papersResult.status === 'fulfilled' ? papersResult.value.count : null,
        europepmc: europeResult.status === 'fulfilled' ? europeResult.value.count : null,
        crossref: crossrefResult.status === 'fulfilled' ? crossrefResult.value.count : null
      }
    };
    if (settled.every(result => result.status === 'rejected')) throw new Error('All literature search services are unavailable');
    onlineLibraryCache.set(cacheKey, { time: Date.now(), value });
    return res.json(value);
  } catch (error) {
    console.error('Online library search failed:', error.message);
    return res.status(502).json({ error: 'The online library is unavailable right now. Please try again shortly.' });
  }
});
app.post('/api/extract', express.raw({ type: 'application/octet-stream', limit: '100mb' }), async (req, res) => {
  try {
    const name = String(req.query.name || '');
    if (!name || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Choose a file to extract.' });
    const buffer = req.body;
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
    res.json({ text, truncated: false });
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
