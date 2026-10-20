# JioSaavn Song Player & Downloader

An unofficial, high-performance full-stack web application for streaming, searching, and downloading high-fidelity songs, albums, playlists, and artists from [JioSaavn](https://jiosaavn.com), complete with embedded metadata, cover art, and synchronized `.lrc` lyrics.

---

## ⚡ Architecture

- **Backend (`/backend`)**: Pure Node.js (ES Modules JavaScript). High-performance API using Hono with native range request streaming proxy (`HTTP 206 Partial Content`), download proxy, in-memory IP rate limiting, SSRF protection, TTL caching, and DES-ECB link decryption via `node-forge`.
- **Frontend (`/frontend`)**: Pure React (JSX JavaScript) built with Vite. Modern dark theme player with Media Session API, continuous Radio Autoplay, offline detection, synchronized glowing lyrics, queue manager, 5-band equalizer, sleep timer, quality selector, and keyboard shortcuts.
- **Serverless Integration (`/api`)**: Vercel Serverless Function entrypoint ready for 0-error 1-click deployment.

---

## ☁️ Deploying to Vercel (Zero-Error Guide)

This codebase is pre-configured to host with **0 errors** on Vercel using either of two setups:

### Option 1: Unified Monorepo (Recommended — 1 Click, Single Domain)
This is the easiest and best method. Both your React frontend and Node.js backend are served from the same domain with **zero CORS headaches**:

1. Push this project to GitHub / GitLab / Bitbucket.
2. Go to your [Vercel Dashboard](https://vercel.com/new) and click **"Add New Project"**.
3. Select your repository.
4. **Do not change the Root Directory** (leave it as `./`).
5. **No environment variables needed** — Vercel reads root [`vercel.json`](file:///d:/Practice%20Projects/Jio%20Saavan%20Song%20Downloader/vercel.json) automatically.
6. Click **Deploy**.
7. Vercel will:
   - Run `npm run build` to compile the React SPA into `frontend/dist`.
   - Deploy static assets globally to the Edge CDN with immutable caching.
   - Bundle `/api/index.js` as a Node.js serverless function to handle all `/api/*`, `/docs`, and `/swagger` endpoints.

---

### Option 2: Separate Backend & Frontend Projects

If you prefer two separate Vercel projects (one for API, one for SPA):

#### 1. Deploy the Backend:
1. In Vercel, import your repo.
2. Under **Root Directory**, click "Edit" and choose `backend`.
3. Click **Deploy**.
4. Once deployed, copy your backend URL (e.g. `https://my-backend-api.vercel.app`).

#### 2. Deploy the Frontend:
1. In Vercel, import your repo again as a new project.
2. Under **Root Directory**, click "Edit" and choose `frontend`.
3. In **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://my-backend-api.vercel.app` (your backend URL from step 1)
4. Click **Deploy**.

---

## 🚀 Running Locally

### 1. Install dependencies

```bash
# In the root directory (backend dependencies)
npm install

# In the frontend directory (React dependencies)
cd frontend
npm install
cd ..
```

### 2. Start the Backend

```bash
# Starts Node.js backend on http://localhost:3000
npm run dev
```

### 3. Start the Frontend (in a second terminal)

```bash
# Starts Vite React dev server on http://localhost:5173 with auto-proxy to backend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause |
| `/` | Focus Search Bar |
| `←` / `→` | Seek -5s / +5s |
| `↑` / `↓` | Volume Up / Down |
| `M` | Mute / Unmute |
| `L` | Toggle Synchronized Lyrics |
| `Q` | Toggle Play Queue |
| `E` | Toggle Equalizer |
| `S` | Toggle Shuffle |
| `R` | Toggle Repeat |
| `Esc` | Close Modals & Drawers |

---

## 📜 License

Distributed under the [MIT License](LICENSE).
