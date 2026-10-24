import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.VITE_APP_URL || 'https://quick-ecommerce-saas-app.web.app';
const TODAY = new Date().toISOString().split('T')[0];

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

const urls: SitemapUrl[] = [
  // 1. SaaS Platform Root
  {
    loc: `${BASE_URL}/`,
    lastmod: TODAY,
    changefreq: 'daily',
    priority: 1.0,
  },
  // 2. Published Live Stores
  {
    loc: `${BASE_URL}/?store=simpler`,
    lastmod: TODAY,
    changefreq: 'daily',
    priority: 0.9,
  },
  // 3. Showcase / Demo Store
  {
    loc: `${BASE_URL}/?store=aurora`,
    lastmod: TODAY,
    changefreq: 'weekly',
    priority: 0.6,
  },
];

// 1. Standard Compliant XML Sitemap (http://www.sitemaps.org/schemas/sitemap/0.9)
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc.replace(/&/g, '&amp;')}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

const xmlPath = path.resolve(__dirname, '../public/sitemap.xml');
fs.writeFileSync(xmlPath, xml, 'utf8');

// 2. Google-Supported Plain Text Sitemap (sitemap.txt)
const txt = urls.map((u) => u.loc).join('\n') + '\n';
const txtPath = path.resolve(__dirname, '../public/sitemap.txt');
fs.writeFileSync(txtPath, txt, 'utf8');

console.log(`[SEO] XML Sitemap generated at: ${xmlPath}`);
console.log(`[SEO] TXT Sitemap generated at: ${txtPath}`);
