// Builds dist/offline.html: Luma's own server HTML + JS chunks + CSS + images + API responses, fully offline.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const ROOT = __dirname, DIST = path.join(ROOT, 'dist'); fs.mkdirSync(DIST, { recursive: true });
const cap = JSON.parse(fs.readFileSync(path.join(ROOT, 'raw/capture.json'), 'utf8'));
const images = JSON.parse(fs.readFileSync(path.join(ROOT, 'raw/images.json'), 'utf8'));
const ORIGIN = 'https://luma.com';
const abs = (u, base = ORIGIN + '/') => { try { return new URL(u.replace(/&amp;/g, '&'), base).href; } catch { return null; } };
const report = { removed: {}, sizes: {}, fonts: {}, privacy: [] };

(async () => {
  let html = cap.html;
  // CSS: inline stylesheets, fonts as data URIs
  const css = {};
  for (const [u, t] of Object.entries(cap.css)) {
    if (!t) continue; let out = t; const urls = [...new Set([...t.matchAll(/url\((['"]?)(?!data:)([^)'"]+)\1\)/g)].map(m => m[2]))];
    for (const ru of urls) { const a = abs(ru, u); let data = null; try { const r = await fetch(a); if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); const ct = (r.headers.get('content-type') || '').split(';')[0] || (a.endsWith('woff2') ? 'font/woff2' : 'application/octet-stream'); data = `data:${ct};base64,${b.toString('base64')}`; report.fonts[a.split('/').pop().slice(0, 60)] = b.length; } } catch {} out = out.split(ru).join(data || 'about:blank'); }
    css[u] = out;
  }
  // scripts: remove src tags from HTML, remember order + attributes
  const order = [];
  html = html.replace(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/g, (m, a1, src, a2) => {
    const attrs = {}; for (const am of (a1 + ' ' + a2).matchAll(/([a-zA-Z_:-]+)(?:="([^"]*)")?/g)) { const n = am[1].toLowerCase(); if (['src', 'async', 'defer', 'nonce', 'integrity', 'crossorigin'].includes(n)) continue; attrs[n] = am[2] == null ? '' : am[2].replace(/&amp;/g, '&'); }
    order.push({ src: abs(src), attrs }); report.removed.scripts = (report.removed.scripts || 0) + 1; return '';
  });
  // stylesheets -> inline <style>; drop preloads/prefetches/preconnects
  html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*\/?>/g, (m, href) => { const k = Object.keys(css).find(u => u === abs(href)); report.removed.stylesheets = (report.removed.stylesheets || 0) + 1; return k ? `<style data-lr-css="${href.split('/').pop()}">${css[k]}</style>` : ''; });
  html = html.replace(/<link\b[^>]*rel="(?:preload|modulepreload|prefetch|preconnect|dns-prefetch)"[^>]*\/?>/g, () => { report.removed.preloads = (report.removed.preloads || 0) + 1; return ''; });
  // remaining third-party tags
  html = html.replace(/<script\b[^>]*src="[^"]*"[^>]*>[\s\S]*?<\/script>/g, () => { report.removed.otherScripts = (report.removed.otherScripts || 0) + 1; return ''; });
  // SSR images -> data URIs
  const imgData = u => { const a = abs(u); const k = a && (images[a] ? a : Object.keys(images).find(x => x.split('?')[0] === a.split('?')[0])); return k ? `data:${images[k].ct || 'image/png'};base64,${images[k].b64}` : null; };
  html = html.replace(/(<img\b[^>]*?\s)src="([^"]+)"/g, (m, pre, u) => { const d = imgData(u); return d ? `${pre}src="${d}"` : m; });
  html = html.replace(/\s(srcset|imagesrcset)="([^"]+)"/g, (m, n, v) => ' ' + n + '="' + v.split(/,\s+(?=\S)/).map(p => { const b = p.trim().split(/\s+/); const d = imgData(b[0]); if (d) b[0] = d; return b.join(' '); }).join(', ') + '"');
  // data payload
  const scripts = {}; for (const [u, t] of Object.entries(cap.scripts)) if (t) scripts[u] = t;
  const api = {}; for (const [u, r] of Object.entries(cap.api)) if (r && r.body != null) api[u] = { status: r.status, ct: r.ct, body: r.body };
  const missing = order.filter(o => !scripts[o.src]).map(o => o.src); if (missing.length) throw new Error('scripts missing: ' + missing.join(','));
  const data = { scripts, css, images, api, order, capturedAt: new Date().toISOString(), source: 'https://luma.com/' };
  const json = JSON.stringify(data); const gz = zlib.gzipSync(Buffer.from(json), { level: 9 }); const b64 = gz.toString('base64');
  report.sizes = { jsonMB: +(json.length / 1048576).toFixed(2), gzMB: +(gz.length / 1048576).toFixed(2), scripts: Object.keys(scripts).length, images: Object.keys(images).length, api: Object.keys(api).length, order: order.length };
  // privacy: the capture is logged-out; flag anything that looks like session/user data
  for (const re of [/"session_token"/, /"api_id":"usr-[A-Za-z0-9]+"/, /luma\.auth/i, /"email":"[^"]+@/]) { if (re.test(json) || re.test(html)) report.privacy.push(String(re)); }
  const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; media-src data: blob:; connect-src data: blob:; worker-src blob:; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";
  const boot = fs.readFileSync(path.join(ROOT, 'boot.js'), 'utf8');
  const inject = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><script>window.LR_DATA=${JSON.stringify(b64)};</script><script>${boot.split('</script').join('<\\/script')}</script>`;
  html = html.replace(/<head([^>]*)>/i, (m) => m + inject);
  fs.writeFileSync(path.join(DIST, 'offline.html'), html);
  fs.writeFileSync(path.join(DIST, 'data.b64'), b64);
  fs.writeFileSync(path.join(DIST, 'shell.html'), html.replace(JSON.stringify(b64), '"__LR_DATA__"'));
  report.sizes.htmlMB = +(html.length / 1048576).toFixed(2);
  fs.writeFileSync(path.join(ROOT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
