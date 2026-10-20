# Luma landing page, offline 1:1 replay

A self-contained recreation of the logged-out [luma.com](https://luma.com/) landing page as captured on 2026-10-20. It runs Luma's own shipped page code, so the three.js floating-card hero, rotating headline, Chicago events, communities, categories, city picker and footer animation behave like the live site, with zero network access.

- **Open:** `index.html` (single file, about 7 MB). Works from disk, or via GitHub Pages.
- **MagicPath:** https://api.magicpath.ai/v1/wondrous-peak-7167

## How it works
`source/build.cjs` takes Luma's server HTML, removes external script/style tags, inlines CSS and fonts, and gzips all 116 JS chunks, 86 images and 4 discover-API responses into the page. `source/boot.js` runs first and serves every request from memory:
- script `src` setters load chunks from blob URLs while reporting their original path (Turbopack identifies chunks by `currentScript.getAttribute("src")`);
- image `src`/`srcset`, `fetch` and `XMLHttpRequest` are answered from the recording; CDN size variants fall back to the captured size of the same image;
- analytics, Sentry and Cloudflare challenge calls get empty responses; a Content-Security-Policy blocks all network access;
- links and forms show a notice instead of navigating.

## Limits
- Data is frozen at capture time (Chicago, Oct 20, 2026). Picking another city shows a notice; only Chicago's events were recorded.
- Sign in, event creation and every link leave the replay, so they are disabled.
- WebGL is required for the hero (it is blank in GPU-less headless browsers).

## Rights
All Luma code, design, text and images belong to Luma (Luma AI, Inc.) and their respective event hosts. This is an unaffiliated, non-commercial reference replay. Remove on request.
