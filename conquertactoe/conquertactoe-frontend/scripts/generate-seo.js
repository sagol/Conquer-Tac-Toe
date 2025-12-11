const fs = require('fs');
const path = require('path');

// Load environment variables (if running locally without create-react-app's injection)
// In a real build, these might be set in the shell or CI
// For local dev, we might need dotenv if we want to read .env files directly
// But since this is a pre-start/pre-build script, we can expect the user to provide them
// or we can try to read .env manually if needed.
// Given the setup, we'll try to use dotenv if available, otherwise rely on process.env.
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not installed or not needed
}

const DOMAIN = process.env.REACT_APP_CLIENT_URL || 'https://gurudo.com'; // Default hardcoded only as fallback
const PUBLIC_DIR = path.join(__dirname, '../public');

console.log(`Generating SEO files for domain: ${DOMAIN}`);

// 1. Generate robots.txt
const robotsContent = `User-agent: *
Allow: /

Sitemap: ${DOMAIN}/sitemap.xml
`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsContent);
console.log('✅ robots.txt generated');

// 2. Generate sitemap.xml
// Simple static sitemap for now, as it was before
const currentDate = new Date().toISOString().split('T')[0];

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${DOMAIN}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${DOMAIN}/rules</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${DOMAIN}/login</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
   <url>
    <loc>${DOMAIN}/register</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapContent);
console.log('✅ sitemap.xml generated');
