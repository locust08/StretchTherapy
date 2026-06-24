import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_URLS = [];

function sanitizeSegment(segment) {
  return decodeURIComponent(segment)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function getRouteInfo(rawUrl) {
  const url = new URL(rawUrl);
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map(sanitizeSegment);

  const folderSegments = segments.length > 0 ? segments : ['home'];
  const folderPath = path.join(...folderSegments);
  const routePath = segments.length > 0 ? `/${segments.join('/')}` : '/';
  const pageFilePath = segments.length > 0
    ? path.join(process.cwd(), 'src', 'pages', ...segments) + '.astro'
    : path.join(process.cwd(), 'src', 'pages', 'index.astro');

  return {
    url: url.toString(),
    folderSegments,
    folderPath,
    routePath,
    pageFilePath,
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function sameOriginAssetPath(match, sourceOrigin) {
  if (match.startsWith('http://') || match.startsWith('https://')) {
    const assetUrl = new URL(match);
    if (assetUrl.origin !== sourceOrigin) return null;
    return assetUrl.pathname + assetUrl.search;
  }

  return match.startsWith('/') ? match : `/${match}`;
}

function collectAssetPaths(content, sourceOrigin) {
  const assetPaths = new Set();
  const assetPattern = /(?:https?:\/\/[^"'\s)]+)?\/?_assets\/[^"'\s)\\]+/g;

  for (const match of content.matchAll(assetPattern)) {
    const assetPath = sameOriginAssetPath(match[0], sourceOrigin);
    if (assetPath) assetPaths.add(assetPath);
  }

  return assetPaths;
}

function renderOuterHeadingStructure(sourceUrl) {
  const pathname = new URL(sourceUrl).pathname.replace(/\/+$/, '') || '/';
  const hiddenStyle = 'position:absolute !important;width:1px !important;height:1px !important;margin:-1px !important;padding:0 !important;overflow:hidden !important;clip:rect(0 0 0 0) !important;clip-path:inset(50%) !important;white-space:nowrap !important;border:0 !important;';

  const outlines = {
    '/': [
      ['h1', 'We are the only gym in Malaysia offering stretching classes and workshops as a form of exercise.'],
      ['h2', 'Stretch Therapy'],
      ['h2', 'For recovery, pain therapy, sports performance and wellbeing'],
      ['h2', 'Why Stretch Therapy'],
      ['h3', 'Clear goals'],
      ['h3', 'Find the root cause, achieve long-lasting effects'],
      ['h3', 'Simple props and equipment'],
      ['h3', 'Body and neural integration'],
      ['h3', 'Proven results'],
      ['h2', 'Who are we'],
      ['h2', 'First-timers'],
      ['h2', 'Follow Us'],
    ],
    '/about': [
      ['h1', 'About Stretch Therapy'],
      ['h2', 'Stretch Therapy Centre Malaysia'],
      ['h2', 'Our founders and teaching approach'],
      ['h2', 'Stretch Therapy for pain relief, mobility and wellbeing'],
    ],
    '/first-timers': [
      ['h1', 'First-Timers'],
      ['h2', 'Start Stretch Therapy safely'],
      ['h2', 'Individual assessment for new students'],
      ['h2', 'Classes for adults of all fitness levels'],
    ],
    '/classes': [
      ['h1', 'Stretch Therapy Classes'],
      ['h2', 'Stretching classes and workshops'],
      ['h2', 'Private classes and assessments'],
      ['h2', 'Class options for recovery, pain therapy and wellbeing'],
    ],
    '/reviews': [
      ['h1', 'Stretch Therapy Reviews'],
      ['h2', 'Student experiences'],
      ['h2', 'Pain relief, flexibility and recovery results'],
    ],
    '/contact': [
      ['h1', 'Contact Us'],
      ['h2', 'Contact Stretch Therapy Centre'],
      ['h2', 'WhatsApp enquiries and private assessment bookings'],
      ['h2', 'Petaling Jaya studio address'],
    ],
    '/privacy-policy': [
      ['h1', 'Privacy and Cookie Policy'],
      ['h2', 'Privacy Policy'],
      ['h2', 'Cookie Policy'],
      ['h2', 'Contact about privacy'],
    ],
    '/corporate': [
      ['h1', 'Resilient Teams, Healthier People, Stronger Performance'],
      ['h2', 'Build resilience as a team through our corporate training programmes'],
      ['h2', 'Trusted by corporate teams'],
      ['h2', 'Self-care, stress regulation and healthier workplace performance'],
    ],
  };

  const outline = outlines[pathname] || [
    ['h1', 'Stretch Therapy'],
    ['h2', 'Pain relief, mobility and wellbeing'],
  ];

  const headings = outline
    .map(([tag, text]) => `      <${tag}>${text}</${tag}>`)
    .join('\n');

  return `    <section aria-label="Page heading structure" style="${hiddenStyle}">
${headings}
    </section>`;
}

async function downloadReferencedAssets(initialContent, sourceOrigin) {
  const queue = [...collectAssetPaths(initialContent, sourceOrigin)];
  const seen = new Set();

  while (queue.length > 0) {
    const assetPath = queue.shift();
    if (!assetPath || seen.has(assetPath)) continue;
    seen.add(assetPath);

    const assetUrl = new URL(assetPath, sourceOrigin);
    const cleanPathname = assetUrl.pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
    const localPath = path.join(process.cwd(), 'public', cleanPathname);

    const response = await fetch(assetUrl);
    if (!response.ok) {
      console.warn(`Skipping asset ${assetUrl}: ${response.status}`);
      continue;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    await ensureDir(path.dirname(localPath));
    await fs.writeFile(localPath, bytes);

    const contentType = response.headers.get('content-type') || '';
    if (
      contentType.includes('text/') ||
      contentType.includes('javascript') ||
      contentType.includes('json') ||
      cleanPathname.endsWith('.css') ||
      cleanPathname.endsWith('.js') ||
      cleanPathname.endsWith('.json')
    ) {
      const text = bytes.toString('utf8');
      queue.push(...collectAssetPaths(text, sourceOrigin));
    }
  }

  return seen.size;
}

function injectRuntimeGuards(html) {
  const runtimeGuard = `
<style data-codex-runtime-guards>
  .w-webflow-badge,
  [data-framer-badge],
  #__framer-badge,
  #__framer-badge-container {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
</style>
<script data-codex-runtime-guards>
  (() => {
    const hasFramerBadgeText = (element) => {
      const nodes = [element, ...element.querySelectorAll('p, span, a, div')];
      return nodes.some((node) => /website with framer|made in framer/i.test((node.textContent || '').trim()));
    };

    const shouldRemoveElement = (element) => {
      if (!(element instanceof HTMLElement)) return false;

      if (
        element.matches('.w-webflow-badge, [data-framer-badge], #__framer-badge, #__framer-badge-container')
      ) {
        return true;
      }

      const href = element.getAttribute('href') || '';
      const text = (element.textContent || '').trim();

      if (/made in webflow/i.test(text) || /made in framer/i.test(text)) {
        return true;
      }

      if (/framer\\.(com|website)/i.test(href)) {
        return true;
      }

      return hasFramerBadgeText(element);
    };

    const hideElement = (element) => {
      if (!(element instanceof HTMLElement)) return;

      element.style.setProperty('display', 'none', 'important');
      element.style.setProperty('visibility', 'hidden', 'important');
      element.style.setProperty('opacity', '0', 'important');
      element.style.setProperty('pointer-events', 'none', 'important');
    };

    const removeInjectedChrome = () => {
      document.querySelectorAll('body *').forEach((element) => {
        if (shouldRemoveElement(element)) {
          hideElement(element);
          element.remove();
        }
      });
    };

    removeInjectedChrome();

    const observer = new MutationObserver(() => {
      removeInjectedChrome();
    });

    const startObserving = () => {
      if (!document.documentElement) return;

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      removeInjectedChrome();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserving, { once: true });
    } else {
      startObserving();
    }

    window.addEventListener('load', removeInjectedChrome);
  })();
</script>`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${runtimeGuard}\n</head>`);
  }

  return `${runtimeGuard}\n${html}`;
}

function normalizeRouteTarget(url) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  return `${url.origin}${pathname}`;
}

async function collectHeadData(page) {
  return page.evaluate(() => {
    const toAttrs = (element) => {
      const attrs = {};
      for (const attr of element.attributes) {
        attrs[attr.name] = attr.value;
      }
      return attrs;
    };

    return {
      title: document.title || '',
      metas: [...document.querySelectorAll('meta')].map(toAttrs),
      links: [...document.querySelectorAll('head link')].map(toAttrs),
    };
  });
}

function renderAstroPage(folderSegments, folderPath, sourceUrl, routeMap) {
  const folderReference = folderPath.split(path.sep).join('/');
  const folderArgs = folderSegments.map((segment) => JSON.stringify(segment)).join(', ');
  const routeMapJson = JSON.stringify(routeMap, null, 2);
  const outerHeadingStructure = renderOuterHeadingStructure(sourceUrl);

  return `---
import fs from 'node:fs/promises';
import path from 'node:path';

const baseDir = path.join(process.cwd(), 'public', 'reference', ${folderArgs});
const head = JSON.parse(await fs.readFile(path.join(baseDir, 'head.json'), 'utf8'));
const sourceUrl = ${JSON.stringify(sourceUrl)};
const routeMap = ${routeMapJson};
const framePath = '/reference/${folderReference}/index.html';
---

<html>
  <head>
    <title>{head.title}</title>
    {head.metas?.map((meta) => <meta {...meta} />)}
    {head.links?.map((link) => <link {...link} />)}
    <style>
      html, body {
        margin: 0;
        height: 100%;
      }

      iframe {
        width: 100%;
        height: 100vh;
        border: 0;
        display: block;
      }

    </style>
  </head>
  <body>
${outerHeadingStructure}
    <iframe id="page-frame" src={framePath}></iframe>
    <script is:inline>
      const iframe = document.getElementById('page-frame');
      const sourceUrlValue = ${JSON.stringify(sourceUrl)};
      const routeMapValue = ${routeMapJson};

      const normalizeTarget = (href) => {
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return null;
        }

        try {
          const resolvedUrl = new URL(href, sourceUrlValue);
          const pathname = resolvedUrl.pathname.replace(/\\/+$/, '') || '/';
          return resolvedUrl.origin + pathname;
        } catch {
          return null;
        }
      };

      const localRouteForHref = (href) => {
        const normalizedTarget = normalizeTarget(href);
        if (!normalizedTarget) return null;
        return routeMapValue[normalizedTarget] || null;
      };

      const rewriteLinks = (root) => {
        root.querySelectorAll?.('a[href]').forEach((link) => {
          const localRoute = localRouteForHref(link.getAttribute('href'));
          if (!localRoute) return;

          link.setAttribute('href', localRoute);
          link.setAttribute('target', '_top');
        });
      };

      iframe?.addEventListener('load', () => {
        const iframeWindow = iframe.contentWindow;
        const iframeDocument = iframe.contentDocument;
        if (!iframeWindow || !iframeDocument) return;

        rewriteLinks(iframeDocument);

        const observer = new iframeWindow.MutationObserver((mutations) => {
          for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === iframeWindow.Node.ELEMENT_NODE) {
                rewriteLinks(node);
              }
            });
          }
        });

        if (iframeDocument.documentElement) {
          observer.observe(iframeDocument.documentElement, {
            childList: true,
            subtree: true,
          });
        }

        iframeDocument.addEventListener('click', (event) => {
          const link = event.target.closest?.('a[href]');
          if (!link) return;

          const localRoute = localRouteForHref(link.getAttribute('href'));
          if (!localRoute) return;

          event.preventDefault();
          window.location.assign(localRoute);
        });
      });
    </script>
  </body>
</html>
`;
}

async function writeAstroPage(routeInfo, routeMap) {
  const astroDir = path.dirname(routeInfo.pageFilePath);
  await ensureDir(astroDir);
  await fs.writeFile(
    routeInfo.pageFilePath,
    renderAstroPage(routeInfo.folderSegments, routeInfo.folderPath, routeInfo.url, routeMap),
    'utf8',
  );
}

async function captureTarget(page, routeInfo, routeMap) {
  console.log(`Capturing ${routeInfo.url} -> ${routeInfo.routePath}`);

  await page.goto(routeInfo.url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.locator('body').waitFor({ state: 'attached', timeout: 15000 });

  await page.evaluate(() => {
    const hasFramerBadgeText = (element) => {
      const nodes = [element, ...element.querySelectorAll('p, span, a, div')];
      return nodes.some((node) => /website with framer|made in framer/i.test((node.textContent || '').trim()));
    };

    document.querySelectorAll('.w-webflow-badge').forEach((element) => element.remove());
    document
      .querySelectorAll('[data-framer-badge], #__framer-badge, #__framer-badge-container')
      .forEach((element) => element.remove());

    document.querySelectorAll('body *').forEach((element) => {
      if (!(element instanceof HTMLElement)) return;

      const href = element.getAttribute('href') || '';
      const text = (element.textContent || '').trim();

      if (
        /made in framer/i.test(text) ||
        /framer\.(com|website)/i.test(href) ||
        hasFramerBadgeText(element)
      ) {
        element.remove();
      }
    });
  });

  const sourceOrigin = new URL(routeInfo.url).origin;
  const rawPageHtml = await page.content();
  const downloadedAssetCount = await downloadReferencedAssets(rawPageHtml, sourceOrigin);
  const pageHtml = injectRuntimeGuards(rawPageHtml.replaceAll(`${sourceOrigin}/_assets/`, '/_assets/'));
  const headData = await collectHeadData(page);

  const outDir = path.join(process.cwd(), 'public', 'reference', routeInfo.folderPath);
  await ensureDir(outDir);

  await fs.rm(path.join(outDir, 'full.html'), { force: true });
  await fs.rm(path.join(outDir, 'body.html'), { force: true });
  await fs.writeFile(path.join(outDir, 'index.html'), pageHtml, 'utf8');
  await fs.writeFile(path.join(outDir, 'head.json'), JSON.stringify(headData, null, 2), 'utf8');
  await writeAstroPage(routeInfo, routeMap);

  console.log(`Downloaded ${downloadedAssetCount} referenced asset(s).`);
}

async function main() {
  const inputUrls = process.argv.slice(2);
  const rawUrls = inputUrls.length > 0 ? inputUrls : DEFAULT_URLS;
  if (rawUrls.length === 0) {
    throw new Error('Pass one or more URLs to capture.');
  }
  const routeInfos = rawUrls.map(getRouteInfo);
  const routeMap = Object.fromEntries(
    routeInfos.map((routeInfo) => [normalizeRouteTarget(new URL(routeInfo.url)), routeInfo.routePath]),
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const routeInfo of routeInfos) {
    await captureTarget(page, routeInfo, routeMap);
  }

  await browser.close();

  console.log('\nGenerated routes:');
  routeInfos.forEach((routeInfo) => {
    console.log(`- ${routeInfo.routePath} -> public/reference/${routeInfo.folderPath}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
