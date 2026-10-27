# LearnIT

LearnIT is a study library for Philippine MLS, Nursing, Psychology, and Pharmacy students. It gives each course a set of suggested study topics based on CHED program standards and published curricula from selected Philippine colleges. Suggestions are not a school-specific or year-by-year degree plan; students should follow their own program handbook.

## Search the library

Choose MLS, Nursing, Psychology, or Pharmacy in your study settings, then search a topic. LearnIT searches NCBI Bookshelf, PubMed, Europe PMC, and Crossref, and filters records for both the query and selected course before showing result cards. Course-focused cards also link to Google Scholar, Semantic Scholar, OpenStax, WHO, and CDC in the current tab. The research search APIs are public and do not require an API key. Result records link to the source; LearnIT does not reproduce full papers.

The course-topic sources appear on the Courses page. They include CHED CMO No. 13, s. 2017 (MLS), CMO No. 15, s. 2017 (Nursing), CMO No. 34, s. 2017 (Psychology), and CMO No. 25, s. 2021 (Pharmacy), and official program pages from New Era University, UP Manila, UP Diliman, UST, and Central Philippine University.

## Run locally

1. Install Node.js 18 or newer.
2. In this directory, run `npm install`.
3. Run `npm start`, then open `http://localhost:3000`.

Ask Lumi provides an in-app chat for course questions and short explanations. Conversation history stays in that browser and is sent to the site owner's configured AI provider; users can clear it at any time. Avoid sharing patient information or other private data.

Lumi, your LearnIT study buddy, extracts PDF, DOCX, PPTX, and TXT uploads. Choose 1–50 flashcards and 1–30 quiz questions. One AI generation creates a full teaching reviewer, a separate plain-language explanation, a comparison against selected-field curriculum suggestions, fresh flashcards, and the requested number of challenging quiz questions. The reviewer is instructed to explain definitions, mechanisms, cause-and-effect, comparisons, worked examples, common misconceptions, and self-check answers rather than simply shorten the source. A PDF button opens the browser print dialog; choose Save as PDF there. Regenerating replaces the current deck only after the new complete bundle is ready. The browser adds no separate file-size cap; the extraction server accepts a request up to 100 MB, and hosting memory and AI model limits may be lower in practice. An uploaded file is never added to My decks by itself. After the reviewer, flashcards, and quiz are all generated, the finished material becomes a named deck. Guests keep decks on that device. Signed-in users sync a private, account-scoped deck library with Supabase; the browser also caches those decks for faster reopening. Extracted text is sent to the AI provider configured by the site owner. Do not upload patient information or other private data.

## Deploy on Render

The repository includes `render.yaml` for a free Node web service. Create a Blueprint from the repository. The service listens on Render's assigned port and serves LearnIT at its `onrender.com` address. If the repository is connected as a public URL, deploy later changes manually; configure GitHub access in Render to enable automatic deploys.

Render free web services sleep after 15 minutes without traffic and can take about a minute to wake. Their filesystem is temporary, so uploads are not saved on the server.

## Enable user accounts

LearnIT opens on a login page. Email/password registration and sign-in use Supabase Auth. Until Supabase is configured, the login page offers a guest preview so friends can test the public study library; guest history stays in that browser. Create a Supabase project, enable email/password authentication, and add the Render URL to Supabase Auth site and redirect URL settings. Add these environment variables to the Render service:

- `SUPABASE_URL`: the project's URL
- `SUPABASE_ANON_KEY`: the public anon/publishable key

Do not put a Supabase service_role key in the website or browser. Once these values are configured, users can register and confirm their email, then log in from another device. Account identity restricts each account to its own deck library. To enable cross-device deck sync, run supabase/learnit_decks.sql once in the Supabase SQL Editor. The table uses row-level security so each account can read, save, update, and delete only its own decks. Until the table exists, LearnIT falls back to a per-account local cache and displays a sync warning.

### Enable Google and Facebook sign-in

In Supabase, open Authentication > Sign In / Providers and enable Google and Facebook with credentials from their respective developer consoles. Add the exact callback URL shown by Supabase (https://<project-ref>.supabase.co/auth/v1/callback) to each provider app. Set the Supabase Site URL to the LearnIT Render origin and add the production and local app origins to its redirect URL allow list. Facebook also requires email permission; people outside the app's tester roles may not be able to sign in until the Facebook app is available to them.

LearnIT starts the OAuth flow with Supabase Auth and returns to the app origin. The social buttons remain unavailable until the public Supabase URL and anon key are configured. Provider client IDs and secrets belong in Supabase, never in Render frontend variables or the repository.
## Login protection and guardrails

Create a Cloudflare Turnstile widget for the LearnIT hostname medstudy-ru0u.onrender.com, then add both values to the Render service environment:

- TURNSTILE_SITE_KEY: the public site key
- TURNSTILE_SECRET_KEY: the private secret key; keep it in Render and out of Git

LearnIT displays the widget on the login page and verifies its single-use token on the server. A verified browser session lasts 12 hours. The server also rate-limits all API routes (120 requests per minute per IP), with tighter limits for email sign-in (8 per 15 minutes), searches (30 per minute), uploads (4 per 15 minutes), AI requests (60 per minute and 300 per hour), and account session actions. If both Turnstile variables are missing, the app remains usable with rate limits but the Cloudflare check is inactive; configure both keys to enable it. If only one key is set, protected features pause until both are supplied.

Rate-limit counters are stored in the Node process memory, so they reset when Render restarts the service and are not shared across multiple instances. For Lumi, the server adds its own education-only safety instructions, demotes client-supplied prompt instructions to task context, limits message sizes, and treats uploaded documents as untrusted content. These protections reduce risk but cannot guarantee every AI response is safe or accurate. Lumi also receives the selected course fields for every AI request. The server rejects prompts that do not match the selected field or shared health-science foundations, and the server-owned prompt instructs the model to decline unrelated requests. Course scope uses a keyword screen, so unusual or very broad terminology may need a clearer health-science term in the question.

The login, Google/Facebook, and guest options require users to check a box agreeing to the Terms & Conditions and acknowledging the Privacy Policy. Email authentication is rate-limited through the LearnIT server before it reaches Supabase.
## Enable Lumi

On Render, configure `AI_API_KEY` and `AI_MODEL` for an OpenAI-compatible chat-completions provider. `AI_BASE_URL` is optional and defaults to the OpenAI API base URL. Keep provider secrets out of Git. Lumi checks setup before sending uploaded text to a model and reports clearly when it is not configured.

## Learning references

Curriculum suggestions are grounded in the official and university sources linked in the app. Online study searches return bibliographic metadata and source links. LearnIT is educational support, not clinical guidance. Verify changing recommendations against current authoritative sources and your instructors' materials.

