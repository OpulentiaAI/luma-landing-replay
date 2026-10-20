import React, { useMemo } from "react";
import { P0 } from "./lumaPage0";
import { P1 } from "./lumaPage1";
import { P2 } from "./lumaPage2";
/** Offline 1:1 replay of the luma.com landing page: Luma's own HTML, JS chunks (incl. three.js hero), CSS, images and API responses, served from memory. No network. */
export function LumaLanding11() {
  const srcDoc = useMemo(() => new TextDecoder().decode(Uint8Array.from(atob(P0 + P1 + P2), c => c.charCodeAt(0))), []);
  return <iframe title="Luma landing replay" data-luma-replay="" srcDoc={srcDoc} sandbox="allow-scripts allow-same-origin" style={{ display: "block", width: "100%", height: "100vh", border: 0, background: "#131517" }} />;
}
export default LumaLanding11;
