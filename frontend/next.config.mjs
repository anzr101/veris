/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy API calls to the backend so the browser stays same-origin.
    // BACKEND_INTERNAL_URL points at the FastAPI service; dev falls back to localhost.
    const api = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${api}/:path*` },
      // FastAPI's interactive docs (served at /api/docs) fetch the schema from the root.
      { source: "/openapi.json", destination: `${api}/openapi.json` },
    ];
  },
  async redirects() {
    return [
      { source: "/papers", destination: "/library", permanent: true },
      { source: "/explore", destination: "/library", permanent: true },
      { source: "/map", destination: "/atlas", permanent: true },
    ];
  },
};

export default nextConfig;
