# SRMS

Scholarship Records Management System.

## Controller integration

SRMS reports health to Controller (central admin dashboard) via outbound heartbeats. Controller does not access this app directly.

1. In Controller: **Projects → Add Project** — copy the project API key (`pk_...`).
2. Set backend env vars (see `backend/.env.example`):
   - `CONTROLLER_URL` — Controller API base URL (e.g. `http://localhost:5000`)
   - `PROJECT_API_KEY` — project key from the dashboard
   - `APP_VERSION` — optional; defaults to the frontend `package.json` version
3. Start the backend. It POSTs to `{CONTROLLER_URL}/api/heartbeat` every 30s with uptime, memory, and request/error counts.
4. When Controller enables maintenance mode, the API returns **503** on user routes. Ops can still check `GET /internal/health` locally.
