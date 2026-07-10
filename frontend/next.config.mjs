/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    // Proxy API calls to the backend so the browser hits the same origin.
    // BACKEND_INTERNAL_URL overrides; otherwise production falls back to the
    // deployed Render API and dev falls back to localhost.
    const api =
      process.env.BACKEND_INTERNAL_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://veris-api-tzpg.onrender.com"
        : "http://localhost:8000");
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
