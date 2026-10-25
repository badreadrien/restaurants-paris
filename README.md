# Mes adresses — Paris

Adrien's personal Paris restaurant list, deployed on Vercel. Code lives here; the
restaurant data is baked into `data.js` from `~/workspace/restaurants/restaurants.json`
(the source of truth maintained in the Restaurants chat).

## What's on the page

One card per restaurant: name, address, type of restaurant, price range, a short
description, and links — Google Maps, the menu, the wine list (when it exists as a
separate page), and the official website. The **Mon avis** column shows Adrien's own
rating (stars) and comment after he visits.

## How editing works (synced, owner-only)

- Viewing is public: anyone with the site URL can read the list and the ratings.
- Ratings/comments are stored online in a Vercel Blob file (`ratings.json`) via
  `api/ratings.js`, so they are the same on every device.
- Writing requires the secret edit key, held in the Vercel project env var
  `EDIT_KEY` (never committed here). To unlock editing on a device, open the site
  once with the edit link: `https://<site>/?edit=<EDIT_KEY>`. The browser remembers
  the key on that device; the **Verrouiller** button in the header forgets it.
- `GET /api/ratings` is public; `POST /api/ratings` returns 401 without the key.

## Layout

- `index.html`, `styles.css`, `app.js` — the page (no framework, no build step)
- `data.js` — the restaurant list (`window.RESTAURANTS`)
- `api/ratings.js` — Vercel Function for the synced ratings (uses `@vercel/blob`)

## Updating the list

Edit `data.js` (or regenerate it from the source JSON), commit, and redeploy.
Ratings live in Blob storage and survive redeploys.
