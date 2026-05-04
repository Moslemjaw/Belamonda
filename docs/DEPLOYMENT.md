## Deployment (Vercel client + Render server)

### Critical security note
If your MongoDB URI ever existed in a committed file, assume it was leaked. Rotate the MongoDB password and update the URI everywhere.

---

## Render (server)

### Create a Web Service
- **Root directory**: `server`
- **Build command**: `npm install && npm run build`
- **Start command**: `npm run start`

### Environment Variables (Render → Environment)
Set:
- `PORT` = `8080` (or let Render provide it; the app reads `PORT`)
- `MONGODB_URI` = your real Mongo connection string
- `JWT_SECRET` = long random string (>= 32 chars)
- `CLIENT_ORIGIN` = your Vercel domain, e.g. `https://<your-app>.vercel.app`

### Health check
- Endpoint: `/health`

---

## Vercel (client)

### Create a Project
- **Root directory**: `client`

### Environment Variables (Vercel → Settings → Environment Variables)
Set:
- `VITE_API_BASE_URL` = your Render API base URL (e.g. `https://<your-render-service>.onrender.com`)
- `VITE_DEFAULT_LOCALE` = `en` (or `ar`)

### Notes
- Vite only exposes vars prefixed with `VITE_`.

---

## CORS alignment
Your server CORS origin is controlled by `CLIENT_ORIGIN`. In production, set it to your Vercel URL. For local dev it’s `http://localhost:5173`.

