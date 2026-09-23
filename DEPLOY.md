# Deploy checklist (free tiers)

## 1. MongoDB Atlas (M0 free)
1. Create cluster, Database Access user (readWrite), Network Access `0.0.0.0/0` (timebox limitation - see README).
2. Connection string: `mongodb+srv://USER:PASS@HOST/ai-prep-kit?retryWrites=true&w=majority`.

## 2. Backend on Render (free web service)
1. New -> Web Service -> connect repo, root `backend/`? This repo is a monorepo: set **Root Directory = repository root**.
   - Build: `npm install && npm run build --workspace=backend`
   - Start: `npm run start --workspace=backend`
   - Or use `backend/render.yaml` as Blueprint.
2. Environment (dashboard, secrets):
   `GROQ_API_KEY`, `MONGODB_URI`, `SESSION_SECRET` (generate), `FRONTEND_URL=https://<vercel>.vercel.app`,
   `GROQ_MODEL=openai/gpt-oss-20b`, `ALLOW_LOCALHOST=false`, `GROQ_DELAY_MS=500`, `NODE_ENV=production`.
3. Note cold starts (~50s): frontend SSE + polling fallback covers it; `GET /api/health` is the health check.
4. `app.set('trust proxy', 1)` is already set so Secure cookies + rate-limit IPs are correct.

## 3. Frontend on Vercel
1. Import repo, Root Directory = `frontend`.
2. Env: `API_URL=https://<render-service>.onrender.com` (used by `next.config.ts` rewrites `/api/*`).
3. Deploy. Browser calls stay same-origin; session cookie is first-party (`SameSite=Lax`).

## 4. Verify prod
- `curl -i https://<vercel>/api/health` -> proxied 200, `Set-Cookie ... SameSite=Lax; HttpOnly`.
- `curl -N https://<vercel>/api/kits/<id>/stream` -> incremental events (else polling fallback engages).
- `npm run evaluate` is local/CI only (needs env file), not run on hosts.
