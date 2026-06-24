import fs from 'node:fs/promises';
import path from 'node:path';

import type { APIRoute } from 'astro';

const routes = [
  {
    path: '/',
    priority: '1.0',
    sources: [
      'src/pages/index.astro',
      'public/reference/home/index.html',
      'public/reference/home/head.json',
    ],
  },
  {
    path: '/about',
    priority: '0.8',
    sources: [
      'src/pages/about.astro',
      'public/reference/about/index.html',
      'public/reference/about/head.json',
    ],
  },
  {
    path: '/first-timers',
    priority: '0.8',
    sources: [
      'src/pages/first-timers.astro',
      'public/reference/first-timers/index.html',
      'public/reference/first-timers/head.json',
    ],
  },
  {
    path: '/classes',
    priority: '0.9',
    sources: [
      'src/pages/classes.astro',
      'public/reference/classes/index.html',
      'public/reference/classes/head.json',
    ],
  },
  {
    path: '/reviews',
    priority: '0.7',
    sources: [
      'src/pages/reviews.astro',
      'public/reference/reviews/index.html',
      'public/reference/reviews/head.json',
    ],
  },
  {
    path: '/contact',
    priority: '0.8',
    sources: [
      'src/pages/contact.astro',
      'public/reference/contact/index.html',
      'public/reference/contact/head.json',
    ],
  },
  {
    path: '/corporate',
    priority: '0.8',
    sources: [
      'src/pages/corporate.astro',
      'public/reference/corporate/index.html',
      'public/reference/corporate/head.json',
    ],
  },
  {
    path: '/privacy-policy',
    priority: '0.3',
    sources: [
      'src/pages/privacy-policy.astro',
      'public/reference/privacy-policy/index.html',
      'public/reference/privacy-policy/head.json',
    ],
  },
];

function absoluteUrl(siteUrl: string, routePath: string) {
  return `${siteUrl}${routePath === '/' ? '/' : routePath}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function latestModifiedDate(sources: string[]) {
  const stats = await Promise.all(
    sources.map(async (source) => {
      const filePath = path.join(process.cwd(), source);
      return fs.stat(filePath);
    }),
  );

  const latestTime = Math.max(...stats.map((stat) => stat.mtimeMs));
  return new Date(latestTime).toISOString();
}

export const GET: APIRoute = async ({ url }) => {
  const siteUrl = (import.meta.env.SITE_URL || url.origin).replace(/\/+$/, '');
  const urls = await Promise.all(
    routes.map(async (route) => {
      const loc = escapeXml(absoluteUrl(siteUrl, route.path));
      const lastmod = await latestModifiedDate(route.sources);

      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <priority>${route.priority}</priority>`,
        '  </url>',
      ].join('\n');
    }),
  );

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
