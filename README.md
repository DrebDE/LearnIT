# MedStudy

A responsive study website for pre-med and health-related students. The sample library, preferences, topic history, file extraction, and study tools are organized so more fields and sources can be added in `app.js`.

## Run locally

1. Install Node.js 18 or newer.
2. In this directory, run `npm install`.
3. Run `npm start`, then open `http://localhost:3000`.

The site works as a sample topic library without AI credentials. PDF, DOCX, PPTX, and TXT extraction runs on the local server. Uploaded files and extracted text stay in memory for the request/session and are not written to disk.

## Publish for free on Render

This project includes `render.yaml` for Render's free Node web service. Create a GitHub repository and push the contents of this folder, then connect that repository to Render with **New → Blueprint**. Render reads the blueprint and creates the service. Set `AI_API_KEY`, `AI_MODEL`, and optionally `AI_BASE_URL` under the service's environment settings if you want AI features online. Keep those values in Render's environment settings; `.gitignore` excludes `.env` from Git.

Render's free web service sleeps after 15 minutes without traffic and may take about a minute to wake on the next visit. Its disk is temporary; this app does not store uploaded files or user preferences on the server, so browser preferences stay on each student's device.

## Configure AI

Copy `.env.example` to `.env`, then set `AI_API_KEY`, `AI_MODEL`, and optionally `AI_BASE_URL` for an OpenAI-compatible chat-completions API. Restart the server after changing `.env`. The API key is read on the server and is never sent to browser JavaScript. With no key configured, the app displays a setup message for AI features.

## Extend the sample library

Add a record to the `topics` array in `app.js`, with a unique `id`, one of the `fields` labels (or a new field), a short description, search keywords, study sections, and source records. This is a starter sample library, not a comprehensive or independently verified curriculum.

Study material is educational support only. AI-created material may contain errors and should be checked against course materials and current authoritative sources.
