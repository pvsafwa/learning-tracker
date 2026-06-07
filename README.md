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

- Resume videos/audio from where you left off.
- A **dashboard** with time invested (today / week / lifetime), a study **streak**, an activity **heatmap**, **continue watching**, **goals** with deadlines & pace projection, and **achievements**.
- Search, filter (in progress / completed / not started), light & dark themes, keyboard shortcuts, Picture-in-Picture, and and per-lesson / per-course / all progress reset.

## Data & privacy

Everything stays on your device:

- Your media files are read locally and never uploaded.
- Progress, durations, activity, goals, and achievements live in your browser's IndexedDB (per browser/device). Clearing site data removes them; there's no account or sync.
