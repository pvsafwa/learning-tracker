# Learning Tracker

A self-hosted web app for tracking progress through your course videos, audio lessons, and PDFs.

The **server** holds your course folders and streams each file to the browser; the **browser** plays them and keeps your progress, goals, streaks, notes, and flashcards in local storage (IndexedDB). Run it on any machine that can reach your media — a home server, a NAS, an Ubuntu box on your LAN, AWS — and open the URL from anywhere on the network.

Because the files are served by the app itself (not read from the visitor's own disk), **it works over plain HTTP** — no HTTPS and no special browser required. It runs in any modern browser.

## Quick start

1. Put your course folders inside the `courses/` directory next to `server.mjs` (or point somewhere else with `COURSES_DIR`, see below).
2. Start the server:
   ```sh
   node server.mjs
   ```
3. Open `http://<server-ip>:4173` (or `http://localhost:4173` on the same machine).

Each top-level folder under the courses directory becomes a course; nested subfolders form an expandable tree. Drop a `.srt`/`.vtt` next to a video (same name) to get captions + a searchable transcript.

## Configuration

| Variable      | Default     | Purpose                                                                      |
| ------------- | ----------- | --------------------------------------------------------------------------- |
| `COURSES_DIR` | `./courses` | Folder that holds your course folders. Absolute or relative to `server.mjs`. |
| `PORT`        | `4173`      | Port to listen on.                                                          |
| `HOST`        | `0.0.0.0`   | Bind address (default: all interfaces).                                     |

Example — point at courses elsewhere on the box and use a different port:

```sh
COURSES_DIR=/home/me/Videos/Courses PORT=8080 node server.mjs
```

Supported media: video (`.mp4`, `.mkv`, `.mov`, `.webm`, …), audio (`.mp3`, `.m4a`, `.flac`, …), and `.pdf`. Files stream with HTTP range support, so seeking and resume work.

### Run it as a background service (Ubuntu / systemd)

```ini
# /etc/systemd/system/learning-tracker.service
[Unit]
Description=Learning Tracker
After=network.target

[Service]
WorkingDirectory=/opt/learning-tracker
Environment=COURSES_DIR=/srv/courses
Environment=PORT=4173
ExecStart=/usr/bin/node server.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl enable --now learning-tracker
```

## How the data works

- **Your media** is read only by the server and streamed over HTTP; it is never copied into the app or uploaded anywhere else.
- **Your progress** (watch position, completion, durations, activity, notes, flashcards, goals, achievements) lives in **your browser's** IndexedDB. It is per browser/device — there's no account or central database, so two people using the same server each keep their own tracking. Use **Backup & restore** (Settings) to move your data between browsers/devices.

## Features

- Resume videos/audio from where you left off; durations are read automatically in the background.
- A **dashboard** with time invested (today / week / lifetime), a study **streak**, an activity **heatmap**, **continue watching**, **goals** with deadlines & pace projection, **flashcards due**, and **achievements**.
- **Active-learning tools:**
  - **Timestamped notes & bookmarks** — capture at the current moment, click to jump back, export to Markdown.
  - **Captions & transcript** — drop a `.srt`/`.vtt` next to a video; get on-screen captions plus a searchable, click-to-seek transcript.
  - **Flashcards + spaced repetition** — make Q&A cards (SM-2 scheduling) and review what's due, right on the dashboard.
  - **AI quizzes** — generate an end-of-lesson multiple-choice quiz from the transcript using your own API key (Google **Gemini** has a free tier; OpenAI and Anthropic also supported). Set it up in **Settings**; quizzes are cached per lesson and can be saved as flashcards.
- **Backup & restore** — export all your data to a JSON file and import it on another device (Settings → Backup & restore).
- Search, filter (in progress / completed / not started), light & dark themes, keyboard shortcuts, Picture-in-Picture, and per-lesson / per-course / all progress reset.
- A built-in **demo library** ("explore a demo") to try the app without any media on the server.

## Keyboard shortcuts

`Space` play/pause · `←/→` seek 10s · `↑/↓` volume · `M` mute · `C` captions · `B` bookmark · `F` fullscreen · `N`/`P` next/previous · `[` toggle sidebar · `?` shortcuts. In a quiz/review: `Space` to reveal, `1–4` to grade.

## Privacy

- Media files never leave the server except as a stream to the browser that requested them.
- Progress and all tracking data stay in each visitor's browser (IndexedDB); preferences and your AI key live in localStorage. The AI key is never included in exported backups.
- AI quizzes send the lesson transcript directly from the browser to your chosen AI provider, using your own key.
