import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Prevent webpack from bundling native Node.js modules used by the
  // ingestion layer.  These must run in the Node.js runtime, not the
  // browser bundle:
  //   canvas     — pdfjs-dist page renderer (native bindings)
  //   pdfjs-dist — PDF parser / renderer
  //   pdf-parse  — PDF text-layer extractor
  // canvas    — node-canvas native module used by pdf-parse for page rendering
  // pdf-parse — PDF library with pdfjs-dist + canvas rendering
  // pdfjs-dist — bundled inside pdf-parse; exclude to prevent double-bundling
  serverExternalPackages: ["canvas", "pdf-parse", "pdfjs-dist"],
};

export default nextConfig;