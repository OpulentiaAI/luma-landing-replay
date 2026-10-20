/* Luma offline replay boot: serves captured chunks, images and API responses from memory. No network. */
(function () {
  'use strict';
  var ORIGIN = 'https://luma.com';
  var D = null, blobs = {}, imgs = {}, ready = false, queue = [];
  function abs(u) { try { return new URL(String(u), ORIGIN + '/').href; } catch (e) { return String(u); } }
  function noQ(u) { return u.split('#')[0]; }
  function keyFor(map, u) { u = abs(u); if (map[u] != null) return u; var n = noQ(u); if (map[n] != null) return n; var p = n.split('?')[0]; for (var k in map) { if (k.split('?')[0] === p) return k; } return null; }
  function toast(msg) { var t = document.getElementById('lr-toast'); if (!t) { t = document.createElement('div'); t.id = 'lr-toast'; t.setAttribute('role', 'status'); t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:rgba(19,21,23,.92);color:#fff;font:14px/20px -apple-system,Inter,system-ui,sans-serif;padding:10px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);pointer-events:none;opacity:0;transition:opacity .2s'; (document.body || document.documentElement).appendChild(t); } t.textContent = msg; t.style.opacity = '1'; clearTimeout(t._h); t._h = setTimeout(function () { t.style.opacity = '0'; }, 2400); }
  window.__lumaReplay = { ready: false, blocked: [], served: { api: 0, img: 0, script: 0 }, toast: toast };

  /* ---------- script src: load from blob, report original URL (Turbopack keys chunks by currentScript.src) ---------- */
  var sDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
  Object.defineProperty(HTMLScriptElement.prototype, 'src', {
    configurable: true, enumerable: true,
    get: function () { return this.__lrSrc || sDesc.get.call(this); },
    set: function (v) { var k = D && keyFor(D.scripts, v); if (k) { this.__lrSrc = k; window.__lumaReplay.served.script++; sDesc.set.call(this, blobs[k]); } else { this.__lrSrc = abs(v); window.__lumaReplay.blocked.push('script ' + v); sDesc.set.call(this, 'data:text/javascript,'); } }
  });
  var getAttr = Element.prototype.getAttribute;
  Element.prototype.getAttribute = function (n) { if (this.__lrSrc && String(n).toLowerCase() === 'src') { try { var u = new URL(this.__lrSrc); return u.origin === ORIGIN ? u.pathname + u.search : this.__lrSrc; } catch (e) { return this.__lrSrc; } } return getAttr.call(this, n); };
  var setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    var ln = String(n).toLowerCase();
    if (this instanceof HTMLScriptElement && ln === 'src') { this.src = v; return; }
    if (this instanceof HTMLImageElement && (ln === 'src')) { this.src = v; return; }
    if ((this instanceof HTMLImageElement || this instanceof HTMLSourceElement) && ln === 'srcset') { return setAttr.call(this, n, mapSrcset(v)); }
    if (this instanceof HTMLLinkElement && ln === 'href') { var rel = (this.rel || this.getAttribute('rel') || '').toLowerCase(); if (/preload|prefetch|modulepreload|preconnect|dns-prefetch/.test(rel)) return setAttr.call(this, n, 'data:,'); if (/stylesheet/.test(rel)) { var ck = D && keyFor(D.css, v); return setAttr.call(this, n, ck ? 'data:text/css;base64,' + btoa(unescape(encodeURIComponent(D.css[ck]))) : 'data:text/css,'); } }
    return setAttr.call(this, n, v);
  };
  /* ---------- images ---------- */
  function cdnTail(u) { var m = String(u).match(/\/cdn-cgi\/image\/[^/]+\/(.+)$/); return m ? m[1].split('?')[0] : null; }
  var tailIdx = null;
  function imgKey(v) { var k = keyFor(imgs, v); if (k) return k; var t = cdnTail(abs(v)); if (!t) return null; if (!tailIdx) { tailIdx = {}; for (var kk in imgs) { var tt = cdnTail(kk); if (!tt) continue; var w = +(kk.match(/width=(\d+)/) || [0, 0])[1]; if (!tailIdx[tt] || w > tailIdx[tt].w) tailIdx[tt] = { k: kk, w: w }; } } return tailIdx[t] ? tailIdx[t].k : null; }
  function imgUrl(v) { if (!v || /^(data|blob):/.test(v)) return v; var k = imgKey(v); if (k) { window.__lumaReplay.served.img++; return imgs[k]; } window.__lumaReplay.blocked.push('img ' + abs(v)); return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='; }
  function mapSrcset(v) { if (!v) return v; return String(v).split(/,\s+(?=\S)/).map(function (part) { var bits = part.trim().split(/\s+/); bits[0] = imgUrl(bits[0]); return bits.join(' '); }).join(', '); }
  var iDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: true, get: function () { return this.__lrSrc || iDesc.get.call(this); }, set: function (v) { this.__lrSrc = abs(v); iDesc.set.call(this, imgUrl(v)); } });
  var ssDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset');
  Object.defineProperty(HTMLImageElement.prototype, 'srcset', { configurable: true, enumerable: true, get: function () { return ssDesc.get.call(this); }, set: function (v) { ssDesc.set.call(this, mapSrcset(v)); } });

  /* ---------- fetch / XHR / beacons ---------- */
  function apiResponse(u) { if (!D) return null; var k = D && keyFor(D.api, u); if (!k) { var p = abs(u).split('?')[0]; for (var kk in D.api) if (kk.split('?')[0] === p) { k = kk; break; } } return k; }
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url) || String(input);
    var go = function () {
      var a = abs(u);
      var k = apiResponse(a); if (k) { var r = D.api[k]; window.__lumaReplay.served.api++; return Promise.resolve(new Response(r.body, { status: r.status || 200, headers: { 'content-type': r.ct || 'application/json' } })); }
      var ik = imgKey(a); if (ik) { window.__lumaReplay.served.img++; return realFetch(imgs[ik]); }
      var sk = D && keyFor(D.scripts, a); if (sk) return Promise.resolve(new Response(D.scripts[sk], { status: 200, headers: { 'content-type': 'application/javascript' } }));
      window.__lumaReplay.blocked.push('fetch ' + a.slice(0, 140));
      if (/[?&]_rsc=|\/_next\/data\//.test(a) || (init && init.headers && (init.headers.RSC || init.headers.rsc || (init.headers.get && init.headers.get('rsc'))))) return Promise.resolve(new Response('', { status: 404 }));
      return Promise.resolve(new Response(/api\.luma\.com/.test(a) ? '{}' : '', { status: /api\.luma\.com/.test(a) ? 200 : 204, headers: { 'content-type': 'application/json' } }));
    };
    return ready ? go() : new Promise(function (res) { queue.push(function () { res(go()); }); });
  };
  var XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__lrUrl = abs(u); };
  XMLHttpRequest.prototype.send = function () { var x = this; window.__lumaReplay.blocked.push('xhr ' + x.__lrUrl.slice(0, 120)); var k = apiResponse(x.__lrUrl); var body = k ? D.api[k].body : ''; ['readyState', 'status', 'responseText', 'response'].forEach(function (p, i) { Object.defineProperty(x, p, { configurable: true, value: [4, k ? 200 : 204, body, body][i] }); }); setTimeout(function () { try { x.onreadystatechange && x.onreadystatechange(); } catch (e) {} x.dispatchEvent(new Event('readystatechange')); x.dispatchEvent(new ProgressEvent('load')); x.dispatchEvent(new ProgressEvent('loadend')); try { x.onload && x.onload(); } catch (e) {} }, 0); };
  try { navigator.sendBeacon = function (u) { window.__lumaReplay.blocked.push('beacon ' + String(u).slice(0, 80)); return true; }; } catch (e) {}
  ['WebSocket', 'EventSource'].forEach(function (k) { window[k] = function () { throw new Error('Luma replay: ' + k + ' disabled'); }; });
  window.open = function () { toast('Opening new windows is disabled in this replay.'); return null; };

  /* ---------- navigation: keep everything on this page ---------- */
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^#/.test(href)) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var label = (a.getAttribute('aria-label') || a.textContent || 'This link').replace(/\s+/g, ' ').trim().slice(0, 48);
    toast(label + ' → opens luma.com' + (href.charAt(0) === '/' ? href.split('?')[0] : '') + ' (outside this replay)');
  }, true);
  var REGIONS = /^(North America|South America|Europe|Asia & Pacific|Africa|Chicago)$/;
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest && ev.target.closest('[role="tooltip"] button');
    if (!b) return; var t = (b.textContent || '').replace(/\s+/g, ' ').trim();
    if (REGIONS.test(t)) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    toast('Only Chicago events were captured in this replay. ' + t + ' opens on luma.com.');
  }, true);
  document.addEventListener('submit', function (ev) { ev.preventDefault(); ev.stopImmediatePropagation(); toast('Forms are disabled in this replay.'); }, true);
  var pS = history.pushState, rS = history.replaceState;
  history.pushState = function () { try { return pS.apply(history, arguments); } catch (e) {} };
  history.replaceState = function () { try { return rS.apply(history, arguments); } catch (e) {} };

  /* ---------- boot ---------- */
  async function boot() {
    var raw = Uint8Array.from(atob(window.LR_DATA), function (c) { return c.charCodeAt(0); });
    window.LR_DATA = null;
    D = JSON.parse(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
    for (var k in D.scripts) blobs[k] = URL.createObjectURL(new Blob([D.scripts[k]], { type: 'text/javascript' }));
    for (var i in D.images) imgs[i] = 'data:' + (D.images[i].ct || 'image/png') + ';base64,' + D.images[i].b64;
    ready = true; queue.splice(0).forEach(function (f) { f(); });
    // re-map any SSR <img> already in the DOM
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src'); if (s && !/^(data|blob):/.test(s)) im.src = s; var ss = im.getAttribute('srcset'); if (ss) setAttr.call(im, 'srcset', mapSrcset(ss)); });
    // run the page's own scripts in document order
    for (var j = 0; j < D.order.length; j++) {
      var o = D.order[j], s = document.createElement('script');
      for (var an in o.attrs) setAttr.call(s, an, o.attrs[an]);
      s.async = false;
      s.src = o.src;
      document.body.appendChild(s);
    }
    window.__lumaReplay.ready = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot().catch(function (e) { window.__lumaReplay.error = String(e && e.stack || e); }); });
  else boot().catch(function (e) { window.__lumaReplay.error = String(e && e.stack || e); });
})();
