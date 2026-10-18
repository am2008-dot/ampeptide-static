// Build the static site: content/*.md -> dist/*.html (clean URLs)
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToHtml } from './markdown.mjs';
import { parseFrontmatter } from './frontmatter.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONTENT = join(ROOT, 'content');
const DIST = join(ROOT, 'dist');
const SITE = JSON.parse(readFileSync(join(CONTENT, '_site.json'), 'utf8'));

// 每次构建前清空 dist，避免残留旧文件
if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });

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

function navLink(n, active) {
  const href = n.href || (n.slug === 'index' ? '/' : '/' + n.slug + '/');
  const external = !!n.href;
  const cls = (!external && n.slug === active) ? ' class="active"' : '';
  const ext = external ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${href}"${cls}${ext}>${esc(n.label)}</a>`;
}

function renderHeader(active) {
  const items = SITE.nav.map(n => {
    if (n.children && n.children.length) {
      const sub = n.children.map(c => {
        const href = c.href || (c.slug === 'index' ? '/' : '/' + c.slug + '/');
        const ext = c.href ? ' target="_blank" rel="noopener"' : '';
        return `<li><a href="${href}"${ext}>${esc(c.label)}</a></li>`;
      }).join('');
      const open = n.children.some(c => !c.href && c.slug === active) ? ' open' : '';
      return `<li class="has-children${open}"><a href="${(n.slug === 'index' ? '/' : '/' + n.slug + '/')}">${esc(n.label)}<span class="caret">▾</span></a><ul class="sub-menu">${sub}</ul></li>`;
    }
    return `<li>${navLink(n, active)}</li>`;
  }).join('');
  return `<header class="site-header">
  <div class="container nav-wrap">
    <a class="brand" href="/">
      <img src="${SITE.logo}" alt="${esc(SITE.name)} logo">
      <span class="brand-text"><strong>${esc(SITE.brandTitle || SITE.name)}</strong><small>${esc(SITE.brandDesc || SITE.tagline)}</small></span>
    </a>
    <button class="menu-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="nav" id="nav"><ul class="menu">${items}</ul></nav>
  </div>
</header>`;
}

function renderHomeCategories() {
  const cats = SITE.homeCategories || [];
  if (!cats.length) return '';
  const cards = cats.map(c => {
    const href = c.href || (c.slug === 'index' ? '/' : '/' + c.slug + '/');
    const ext = c.href ? ' target="_blank" rel="noopener"' : '';
    return `<a class="category-card" href="${href}"${ext}>
      <div class="category-image"><img src="${esc(c.image)}" alt="${esc(c.label)}"></div>
      <div class="category-body">
        <h3>${esc(c.label)}</h3>
        ${c.description ? `<p>${esc(c.description)}</p>` : ''}
      </div>
    </a>`;
  }).join('');
  return `<section class="home-categories"><div class="container">
    <h2 class="section-title">Explore AMP Peptide</h2>
    <div class="category-grid">${cards}</div>
  </div></section>`;
}

const PRODUCT_LINK_MAP = Object.fromEntries((SITE.productLinks || []).map(p => [p.label, p.slug]));

function linkProductNames(html, slug) {
  if (slug !== 'amp-peptide-product-list') return html;
  // Only link bare product names inside table cells, skip if already linked
  return html.replace(/<td>([^<]+?)<\/td>/g, (match, text) => {
    const key = text.trim();
    if (PRODUCT_LINK_MAP[key]) {
      return `<td><a href="/${PRODUCT_LINK_MAP[key]}/">${esc(key)}</a></td>`;
    }
    return match;
  });
}

function renderFooter() {
  const c = SITE.contact;
  const notice = SITE.footer.noticeLinks.map(l => {
    const href = l.href || (l.slug === 'index' ? '/' : '/' + l.slug + '/');
    return `<li><a href="${href}">${esc(l.label)}</a></li>`;
  }).join('');
  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <img src="${SITE.logo}" alt="${esc(SITE.name)} logo">
      <p class="fb-name">${esc(SITE.brandTitle || SITE.fullName)}</p>
      <p class="fb-desc">${esc(SITE.brandDesc || SITE.description)}</p>
      <p class="fb-contact">Email: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br>Address: ${esc(c.address)}</p>
    </div>
    <div class="footer-notice">
      <h4>${esc(SITE.footer.noticeTitle || 'Research Use Notice')}</h4>
      <ul class="notice-links">${notice}</ul>
    </div>
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
  let body = mdToHtml(entry.body || '')
    // page title is already rendered by the hero / page-hero banner →
    // demote any in-body H1 to H2 so each page keeps a single H1
    .replace(/<h1([^>]*)>/g, '<h2$1>').replace(/<\/h1>/g, '</h2>');
  body = linkProductNames(body, entry.slug);
  const h = SITE.hero || {};
  const hero = entry.slug === 'index'
    ? `<section class="hero">
        <div class="hero-cover" style="background-image:url('${esc(SITE.hero.image || SITE.pageHeroBg)}')">
          <div class="hero-dim"></div>
          <div class="container hero-inner">
            <h1>${esc(h.title || SITE.fullName)}</h1>
            <p class="lead">${esc(h.subtitle || SITE.description)}</p>
          </div>
        </div>
      </section>`
    : `<section class="page-hero"><div class="container">
        <div class="eyebrow">${esc(SITE.name)}</div>
        <h1>${esc(entry.title)}</h1>
      </div></section>`;
  const homeCats = entry.slug === 'index' ? renderHomeCategories() : '';
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
    .replace('{{BODY}}', hero + homeCats + `<article class="prose">${body}</article>`)
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

// copy CMS admin (custom backend UI) so /admin/ is served
if (existsSync(join(ROOT, 'admin'))) cpSync(join(ROOT, 'admin'), join(DIST, 'admin'), { recursive: true });

// copy Pages Functions so /api/* backend is served
if (existsSync(join(ROOT, 'functions'))) cpSync(join(ROOT, 'functions'), join(DIST, 'functions'), { recursive: true });

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
