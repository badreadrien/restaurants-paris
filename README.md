# Mes adresses — Paris

Adrien's personal Paris restaurant list, deployed on Vercel. **This repo holds code
only — all data lives server-side** in a Vercel Blob store attached to the project.

## Architecture (v2)

All data lives in the project's Vercel Blob store, one small JSON document per
record (so concurrent writes can't clobber each other), written through
key-gated API functions:

- `restaurants/<id>.json` — the list itself. `GET /api/restaurants` is public
  (the page renders from it); writes (`POST` with an array, `{add: record}` or
  `{remove: id}`) require the edit key.
- `ratings/<id>.json` — Adrien's own stars + comments ("Mon avis").
  `GET /api/ratings` public; `POST` requires the edit key.
- `submissions/<id>.json` — the "add a restaurant" queue. All methods require
  the edit key. The site's form (edit mode) posts a name here; a scheduled job
  on Adrien's Muse picks pending entries up every ~15 minutes, verifies and
  enriches them (address, type, price, description, menu and wine-list links),
  adds them via `/api/restaurants`, and marks the submission done.

The edit key lives only in the Vercel project env var `EDIT_KEY` (never in this
repo). To unlock editing on a device, open the site once with the edit link:
`https://<site>/?edit=<EDIT_KEY>`. The browser remembers the key on that device;
the **Verrouiller** button in the header forgets it.

## Layout

- `index.html`, `styles.css`, `app.js` — the page (no framework, no build step);
  the list is fetched from `/api/restaurants` at load.
- `api/restaurants.js` — the list (Blob-backed).
- `api/ratings.js` — Adrien's ratings/comments (Blob-backed).
- `api/submissions.js` — the add-a-restaurant queue (Blob-backed, key-gated).

## Updating the list

Use the site's own form (edit mode), or ask Muse in chat — both end up in the
server-side list. No redeploy is needed for data changes; redeploys are only for
code changes.
