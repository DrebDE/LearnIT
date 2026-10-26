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

Lumi, your LearnIT study buddy, extracts PDF, DOCX, PPTX, and TXT uploads. Choose 1–50 flashcards; one AI generation creates a structured reviewer, a plain-language guide, a comparison against selected-field curriculum suggestions, fresh flashcards, and an 8-question challenging quiz. Regenerating replaces the deck with a new set. The browser adds no separate file-size cap; the extraction server accepts a request up to 100 MB, and hosting memory and AI model limits may be lower in practice. After generation, the upload becomes a named deck with its reviewer, flashcards, quiz, and locally saved review progress. Decks and extracted text are saved in IndexedDB on that device so they can be reopened in My decks. They are not synchronized across devices or stored by LearnIT on its server. Extracted text is sent to the AI provider configured by the site owner. Do not upload patient information or other private data.

## Deploy on Render

The repository includes `render.yaml` for a free Node web service. Create a Blueprint from the repository. The service listens on Render's assigned port and serves LearnIT at its `onrender.com` address. If the repository is connected as a public URL, deploy later changes manually; configure GitHub access in Render to enable automatic deploys.

Render free web services sleep after 15 minutes without traffic and can take about a minute to wake. Their filesystem is temporary, so uploads are not saved on the server.

## Enable user accounts

LearnIT opens on a login page. Email/password registration and sign-in use Supabase Auth. Until Supabase is configured, the login page offers a guest preview so friends can test the public study library; guest history stays in that browser. Create a Supabase project, enable email/password authentication, and add the Render URL to Supabase Auth site and redirect URL settings. Add these environment variables to the Render service:

- `SUPABASE_URL`: the project's URL
- `SUPABASE_ANON_KEY`: the public anon/publishable key

Do not put a Supabase service_role key in the website or browser. Once these values are configured, users can register and confirm their email, then log in from another device. Login is identity only; study decks and preferences remain in each browser.

### Enable Google and Facebook sign-in

In Supabase, open Authentication > Sign In / Providers and enable Google and Facebook with credentials from their respective developer consoles. Add the exact callback URL shown by Supabase (https://<project-ref>.supabase.co/auth/v1/callback) to each provider app. Set the Supabase Site URL to the LearnIT Render origin and add the production and local app origins to its redirect URL allow list. Facebook also requires email permission; people outside the app's tester roles may not be able to sign in until the Facebook app is available to them.

LearnIT starts the OAuth flow with Supabase Auth and returns to the app origin. The social buttons remain unavailable until the public Supabase URL and anon key are configured. Provider client IDs and secrets belong in Supabase, never in Render frontend variables or the repository.
## Enable Lumi

On Render, configure `AI_API_KEY` and `AI_MODEL` for an OpenAI-compatible chat-completions provider. `AI_BASE_URL` is optional and defaults to the OpenAI API base URL. Keep provider secrets out of Git. Lumi checks setup before sending uploaded text to a model and reports clearly when it is not configured.

## Learning references

Curriculum suggestions are grounded in the official and university sources linked in the app. Online study searches return bibliographic metadata and source links. LearnIT is educational support, not clinical guidance. Verify changing recommendations against current authoritative sources and your instructors' materials.
