/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The existing Webflow export lives in public/ and is served as-is. Next.js
  // will not serve public/index.html at "/", so rewrite the root across.
  // Every other page keeps its original .html URL with no redirect.
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }]
  },

  // Friendly aliases for the pages that already existed, so links written
  // without the extension still land somewhere sensible.
  async redirects() {
    return [
      { source: '/menu', destination: '/menu.html', permanent: true },
      { source: '/jobs', destination: '/jobs.html', permanent: true },
      { source: '/reservations', destination: '/book', permanent: false },
    ]
  },
}

module.exports = nextConfig
