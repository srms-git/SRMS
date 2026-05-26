# Deploy SRMS (frontend + backend)

Vercel hosts **only the React frontend**. MongoDB and the Express API must run elsewhere.

## Why login shows 405 on Vercel

Without `VITE_API_URL`, the app calls `https://your-app.vercel.app/api/...`. Vercel serves `index.html` for those paths, so **POST login returns 405**.

## 1. Deploy backend (Render example)

1. Push this repo to GitHub.
2. [Render](https://render.com) → **New** → **Blueprint** → select repo (`render.yaml`).
3. In the **srms-api** service → **Environment**, add variables from `backend/.env.example` (use your real `MONGO_URI`, `JWT_SECRET`, etc.).
4. Set `FRONTEND_URL` to your Vercel URL (e.g. `https://srms-red.vercel.app`).
5. After deploy, copy the API URL (e.g. `https://srms-api.onrender.com`).

**MongoDB Atlas:** Network Access → allow `0.0.0.0/0` (or Render’s IPs) so the cloud API can reach the database.

## 2. Connect Vercel frontend to the API

1. Vercel → your project → **Settings** → **Environment Variables**.
2. Add:

   | Name | Value |
   |------|--------|
   | `VITE_API_URL` | `https://srms-api.onrender.com/api` (your real API URL + `/api`) |

3. Apply to **Production** (and Preview if needed).
4. **Deployments** → **Redeploy** (required: Vite bakes env vars at build time).

## 3. Verify

- Open `https://your-api.onrender.com/` → should show `SRMS Backend is Running!`
- Login on Vercel → should hit `POST .../api/auth/login` on Render, not Vercel.
