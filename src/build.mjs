// Build the static site: content/*.md -> dist/*.html (clean URLs)
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToHtml } from './markdown.mjs';
import { parseFrontmatter } from './frontmatter.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONTENT = join(ROOT, 'content');
const DIST = join(ROOT, 'dist');
const SITE = JSON.parse(readFileSync(join(CONTENT, '_site.json'), 'utf8'));

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readEntries(folder) {
  const dir = join(CONTENT, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const { data, body } = parseFrontmatter(readFileSync(join(dir, f), 'utf8'));
    return { ...data, body, file: f };
  });
}

const urlFor = slug => slug === 'index' ? SITE.url + '/' : SITE.url + '/' + slug + '/';
const outPath = slug => slug === 'index' ? join(DIST, 'index.html') : join(DIST, slug, 'index.html');

function renderHeader(active) {
  const links = SITE.nav.map(n => {
    const href = n.href || (n.slug === 'index' ? '/' : '/' + n.slug + '/');
    const external = !!n.href;
    const cls = (!external && n.slug === active) ? ' class="active"' : '';
    const ext = external ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${cls}${ext}>${esc(n.label)}</a>`;
  }).join('');
  return `<header class="site-header">
  <div class="container nav-wrap">
    <a class="brand" href="/"><img src="${SITE.logo}" alt="${esc(SITE.name)}"><span>${esc(SITE.name)}<small>${esc(SITE.tagline)}</small></span></a>
    <button class="menu-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="nav" id="nav">${links}<a class="btn btn-primary" href="/contact/">Get a Quote</a></nav>
  </div>
</header>`;
}

function renderFooter() {
  const cols = SITE.footer.columns.map(c => {
    const links = c.links.map(l => {
      const href = l.href || (l.slug === 'index' ? '/' : '/' + l.slug + '/');
      return `<a href="${href}">${esc(l.label)}</a>`;
    }).join('');
    return `<div><h4>${esc(c.title)}</h4>${links}</div>`;
  }).join('');
  const c = SITE.contact;
  return `<footer class="site-footer">
  <div class="footer-grid">
    <div class="footer-brand"><img src="${SITE.logo}" alt="${esc(SITE.name)} logo"><p>${esc(SITE.description)}</p>
      <p>Email: ${esc(c.email)}<br>Address: ${esc(c.address)}</p></div>
    ${cols}
  </div>
  <div class="footer-bottom"><div class="container">© ${new Date().getFullYear()} ${esc(SITE.fullName)}. All rights reserved. · Research peptides are for laboratory research use only.</div></div>
</footer>`;
}

function jsonLd(entry) {
  if (entry.type === 'post') {
    return {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: entry.title, description: entry.description,
      image: SITE.url + (entry.image || SITE.ogImage),
      datePublished: entry.date, dateModified: entry.modified || entry.date,
      author: { '@type': 'Organization', name: SITE.name },
      publisher: { '@type': 'Organization', name: SITE.name, logo: { '@type': 'ImageObject', url: SITE.url + SITE.logo } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': urlFor(entry.slug) }
    };
  }
  if (entry.slug === 'index') {
    return {
      '@context': 'https://schema.org', '@type': 'Organization',
      name: SITE.fullName, url: SITE.url, logo: SITE.url + SITE.logo, description: SITE.description,
      contactPoint: { '@type': 'ContactPoint', email: SITE.contact.email, contactType: 'sales' }
    };
  }
  return {
    '@context': 'https://schema.org', '@type': 'WebPage', name: entry.title,
    description: entry.description, url: urlFor(entry.slug),
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url }
  };
}

function buildPage(entry) {
  const body = mdToHtml(entry.body || '')
    // page title is already rendered by the hero / page-hero banner →
    // demote any in-body H1 to H2 so each page keeps a single H1
    .replace(/<h1([^>]*)>/g, '<h2$1>').replace(/<\/h1>/g, '</h2>');
  const h = SITE.hero || {};
  const hero = entry.slug === 'index'
    ? `<section class="hero">
        <img class="hero-bg" src="${esc(SITE.pageHeroBg)}" alt="">
        <div class="container">
          <span class="eyebrow">${esc(h.eyebrow || SITE.name)}</span>
          <h1>${esc(h.title || SITE.fullName)}</h1>
          <p class="lead">${esc(h.subtitle || SITE.description)}</p>
          <div class="actions">
            <a class="btn btn-primary" href="/${esc((h.primary && h.primary.slug) || 'contact')}/">${esc((h.primary && h.primary.label) || 'Get a Quote')}</a>
            <a class="btn btn-ghost" href="/${esc((h.secondary && h.secondary.slug) || 'amp-peptide-product-list')}/">${esc((h.secondary && h.secondary.label) || 'View Catalog')}</a>
          </div>
        </div>
      </section>`
    : `<section class="page-hero"><div class="container">
        <div class="eyebrow">${esc(SITE.name)}</div>
        <h1>${esc(entry.title)}</h1>
      </div></section>`;
  const meta = [
    `<meta name="description" content="${esc(entry.description || '')}">`,
    `<link rel="canonical" href="${esc(urlFor(entry.slug))}">`,
    `<meta property="og:type" content="${entry.type === 'post' ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${esc(entry.title)}">`,
    `<meta property="og:description" content="${esc(entry.description || '')}">`,
    `<meta property="og:url" content="${esc(urlFor(entry.slug))}">`,
    `<meta property="og:image" content="${esc(SITE.url + (entry.image || SITE.ogImage))}">`,
    `<meta property="og:site_name" content="${esc(SITE.name)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(entry.title)}">`,
    `<meta name="twitter:description" content="${esc(entry.description || '')}">`,
    `<meta name="twitter:image" content="${esc(SITE.url + (entry.image || SITE.ogImage))}">`
  ].join('\n  ');
  const html = readFileSync(join(ROOT, 'src', 'template.html'), 'utf8')
    .replace('{{TITLE}}', `<title>${esc(entry.title)}</title>`)
    .replace('{{META}}', meta)
    .replace('{{HEADER}}', renderHeader(entry.slug))
    .replace('{{BODY}}', hero + `<article class="prose">${body}</article>`)
    .replace('{{FOOTER}}', renderFooter())
    .replace('{{JSONLD}}', `<script type="application/ld+json">${JSON.stringify(jsonLd(entry))}</script>`);
  const op = outPath(entry.slug);
  mkdirSync(dirname(op), { recursive: true });
  writeFileSync(op, html);
  return urlFor(entry.slug);
}

const pages = readEntries('pages');
const posts = readEntries('posts');
const all = [...pages, ...posts];
const urls = [];
for (const e of all) if (e.slug) urls.push(buildPage(e));

// copy static assets
if (existsSync(join(ROOT, 'assets'))) cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });

// copy CMS admin (Decap) so /admin/ is served
if (existsSync(join(ROOT, 'admin'))) cpSync(join(ROOT, 'admin'), join(DIST, 'admin'), { recursive: true });

// sitemap
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u)}</loc><changefreq>weekly</changefreq></url>`).join('\n')}
</urlset>\n`;
writeFileSync(join(DIST, 'sitemap.xml'), sm);

// robots
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE.url}/sitemap.xml\n`);

// 404
const nf = readFileSync(join(ROOT, 'src', 'template.html'), 'utf8')
  .replace('{{TITLE}}', '<title>404 — Page Not Found</title>')
  .replace('{{META}}', '<meta name="robots" content="noindex">')
  .replace('{{HEADER}}', renderHeader(''))
  .replace('{{BODY}}', '<section class="section"><div class="container" style="text-align:center;padding:90px 0"><h1 style="font-size:64px;margin:0">404</h1><p>The page you are looking for could not be found.</p><a class="btn btn-primary" href="/">Back to Home</a></div></section>')
  .replace('{{FOOTER}}', renderFooter())
  .replace('{{JSONLD}}', '');
writeFileSync(join(DIST, '404.html'), nf);

console.log(`✅ Built ${all.length} pages + sitemap/robots/404 → ${DIST}`);
