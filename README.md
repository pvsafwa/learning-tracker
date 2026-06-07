# Learning Tracker

A local-first web app for tracking progress through your course videos, audio lessons, and PDFs.

It runs as a tiny static web app. The **browser** reads a folder you pick on your own computer (via the File System Access API) and plays the files locally — nothing is uploaded. All your progress, goals, streaks, and achievements are stored in your browser (IndexedDB). This means you can host it anywhere (e.g. AWS) and each visitor uses **their own** local course folders.

## Browser support

Requires a **Chromium-based browser**: Chrome, Edge, Arc, or Brave. Safari and Firefox don't support the File System Access API and will show an "unsupported browser" message.

## Run locally

```sh
node server.mjs
```

Then open `http://localhost:4173`. (`localhost` counts as a secure context, so the folder picker works.)

## Deploy (e.g. AWS)

The server is just a static file host — it serves the contents of `public/`. You can run `node server.mjs` behind anything that terminates **HTTPS** (an ALB, CloudFront, nginx, Caddy…), or upload `public/` to any static host (S3 + CloudFront, etc.).

- **HTTPS is required.** The File System Access API only works in a secure context (HTTPS or `localhost`).
- Configure the port with `PORT` (default `4173`) and bind host with `HOST` (default `0.0.0.0`).

## How it works for a user

1. Open the app and click **Choose courses folder**.
2. Pick the folder that contains your course folders. The browser asks permission once.
3. Each subfolder becomes a course; nested subfolders form an expandable tree. Files placed directly in the chosen folder are grouped under that folder's name.
4. Your browser remembers the folder. On a later visit it may ask you to **reconnect** it (a browser security measure) — one click and you're back.

Supported media: video (`.mp4`, `.mkv`, `.mov`, `.webm`, …), audio (`.mp3`, `.m4a`, `.flac`, …), and `.pdf`.

## Features

- Resume videos/audio from where you left off; durations are read automatically in the background.
- A **dashboard** with time invested (today / week / lifetime), a study **streak**, an activity **heatmap**, **continue watching**, **goals** with deadlines & pace projection, **flashcards due**, and **achievements**.
- **Active-learning tools:**
  - **Timestamped notes & bookmarks** — capture at the current moment, click to jump back, export to Markdown.
  - **Captions & transcript** — drop a `.srt`/`.vtt` next to a video; get on-screen captions plus a searchable, click-to-seek transcript.
  - **Flashcards + spaced repetition** — make Q&A cards (SM-2 scheduling) and review what's due, right on the dashboard.
  - **AI quizzes** — generate an end-of-lesson multiple-choice quiz from the transcript using your own API key (Google **Gemini** has a free tier; OpenAI and Anthropic also supported). Set it up in **Settings**; quiz questions can be saved as flashcards.
- **Backup & restore** — export all your data to a JSON file and import it on another device (Settings → Backup & restore).
- Search, filter (in progress / completed / not started), light & dark themes, keyboard shortcuts, Picture-in-Picture, and per-lesson / per-course / all progress reset.
- A built-in **demo library** ("explore a demo" on the welcome screen) to try the app without picking a folder.

## Keyboard shortcuts

`Space` play/pause · `←/→` seek 10s · `↑/↓` volume · `M` mute · `C` captions · `B` bookmark · `F` fullscreen · `N`/`P` next/previous · `[` toggle sidebar · `?` shortcuts. In a quiz/review: `Space` to reveal, `1–4` to grade.

## Data & privacy

Everything stays on your device:

- Your media files are read locally and never uploaded.
- Progress, durations, activity, notes, flashcards, goals, and achievements live in your browser's IndexedDB (per browser/device); preferences and your AI key live in localStorage. There's no account or sync — use **Backup & restore** to move between devices.
- AI quizzes send the lesson transcript directly from your browser to your chosen AI provider, using your own key. The key is never included in exported backups.
