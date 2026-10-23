# LearnIT

LearnIT is a searchable study space for pre-med and health-science students. It includes MLS, Nursing, and Psychology four-year curriculum maps, detailed study guides, NCBI Bookshelf topic search, and live PubMed citation search. Program sequences differ by country and school; the maps are study guides, not official degree plans.

## Run locally

1. Install Node.js 18 or newer.
2. In this directory, run `npm install`.
3. Run `npm start`, then open `http://localhost:3000`.

Local topic search checks the MLS, Nursing, and Psychology maps and study guides. Online topic search queries NCBI Bookshelf; paper search queries PubMed through NCBI E-utilities. Results link to the source records and do not reproduce full papers. PDF, DOCX, PPTX, and TXT extraction runs on the server. Uploaded files and extracted text stay in memory for the request/session and are not written to disk.

## Deploy on Render

The repository includes `render.yaml` for a free Node web service. Create a Blueprint from the repository. The service listens on Render's assigned port and serves LearnIT at its `onrender.com` address. If the repository is connected as a public URL, deploy later changes manually; configure GitHub access in Render to enable automatic deploys.

Render free web services sleep after 15 minutes without traffic and can take about a minute to wake. Their filesystem is temporary, so the app does not save uploaded files on the server.

## Enable user accounts

LearnIT uses Supabase Auth for email/password registration and sign-in. Create a Supabase project, enable email/password authentication, and set the site's URL to the Render address under the Supabase Auth URL settings. Add these environment variables to the Render service:

- `SUPABASE_URL`: the project's URL
- `SUPABASE_ANON_KEY`: the public anon/publishable key

Do not put a Supabase `service_role` key in the website or browser. Once these values are configured, users can register and confirm their email, then log in from another device. Login is identity only; study history and preferences remain in each browser.

Supabase's Free plan is suitable for a small shared study site, but free projects can pause after a week of inactivity. Check current [Supabase pricing and limits](https://supabase.com/pricing).

## Optional AI study tools

Copy `.env.example` to `.env`, then set `AI_API_KEY`, `AI_MODEL`, and optionally `AI_BASE_URL` for an OpenAI-compatible chat-completions API. On Render, set them in the service environment settings. Keep provider secrets out of Git; `.gitignore` excludes `.env`.

## Curriculum and research notes

Curriculum maps are broad learning progressions based on open textbooks and professional education standards. They do not claim to cover every program or replace a school's current course plan. Detailed topic guides link their references. The online topic search queries NCBI Bookshelf and links to source chapters. The research search uses PubMed through NCBI E-utilities and links to original records.

LearnIT is educational support, not clinical guidance. Verify changing recommendations against current authoritative sources and your instructors' materials.
