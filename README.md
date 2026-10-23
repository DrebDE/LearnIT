# LearnIT

LearnIT is a study library for Philippine MLS, Nursing, and Psychology students. It gives each course a set of suggested study topics based on CHED program standards and published curricula from selected Philippine colleges. Suggestions are not a school-specific or year-by-year degree plan; students should follow their own program handbook.

## Search the library

Enter any topic in the homepage search box. LearnIT searches NCBI Bookshelf, PubMed, Europe PMC, and Crossref, then presents matching books, chapters, and research records as cards. Search links also open Google Scholar, Semantic Scholar, OpenStax, WHO, and CDC. The research search APIs are public and do not require an API key. Result records link to the source; LearnIT does not reproduce full papers.

The course-topic sources appear on the Courses page. They include CHED CMO No. 13, s. 2017 (MLS), CMO No. 15, s. 2017 (Nursing), CMO No. 34, s. 2017 (Psychology), and official program pages from New Era University, UP Manila, UP Diliman, UST, and Central Philippine University.

## Run locally

1. Install Node.js 18 or newer.
2. In this directory, run `npm install`.
3. Run `npm start`, then open `http://localhost:3000`.

PDF, DOCX, PPTX, and TXT uploads are extracted in memory. When the AI Buddy is configured, an upload starts one AI request that creates a reviewer and flashcards together. The extracted text is sent to the AI provider configured by the site owner; LearnIT does not save the uploaded file on its server. Do not upload patient information or other private data.

## Deploy on Render

The repository includes `render.yaml` for a free Node web service. Create a Blueprint from the repository. The service listens on Render's assigned port and serves LearnIT at its `onrender.com` address. If the repository is connected as a public URL, deploy later changes manually; configure GitHub access in Render to enable automatic deploys.

Render free web services sleep after 15 minutes without traffic and can take about a minute to wake. Their filesystem is temporary, so uploads are not saved on the server.

## Enable user accounts

LearnIT opens on a login page. Email/password registration and sign-in use Supabase Auth. Until Supabase is configured, the login page offers a guest preview so friends can test the public study library; guest history stays in that browser. Create a Supabase project, enable email/password authentication, and add the Render URL to Supabase Auth site and redirect URL settings. Add these environment variables to the Render service:

- `SUPABASE_URL`: the project's URL
- `SUPABASE_ANON_KEY`: the public anon/publishable key

Do not put a Supabase `service_role` key in the website or browser. Once these values are configured, users can register and confirm their email, then log in from another device. Login is identity only; study history and preferences remain in each browser.

## Enable the AI Buddy

On Render, configure `AI_API_KEY` and `AI_MODEL` for an OpenAI-compatible chat-completions provider. `AI_BASE_URL` is optional and defaults to the OpenAI API base URL. Keep provider secrets out of Git. The AI Buddy checks setup before sending uploaded text to a model and reports clearly when it is not configured.

## Learning references

Curriculum suggestions are grounded in the official and university sources linked in the app. Online study searches return bibliographic metadata and source links. LearnIT is educational support, not clinical guidance. Verify changing recommendations against current authoritative sources and your instructors' materials.
