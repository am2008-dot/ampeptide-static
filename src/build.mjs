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

let CAT_MAP = {};
try {
  CAT_MAP = Object.fromEntries(JSON.parse(readFileSync(join(CONTENT, 'categories.json'), 'utf8')).map((c) => [c.slug, c]));
} catch (e) { /* categories.json 可选 */ }

// ==================== 首页专用组件 ====================
const HOME_STATS = [
  { n: '10+', l: 'Years of peptide manufacturing', s: 'since 2012' },
  { n: '3,000 m²', l: 'Facility in Suzhou Industrial Park', s: 'incl. GMP workshop' },
  { n: '80+', l: 'Catalog & custom compounds', s: 'research to bulk' },
  { n: 'Global', l: 'Export experience', s: 'docs & cold-chain ready' },
];

const HOME_ADV = [
  { icon: '🏭', t: 'GMP-Compliant Workshop', d: 'A controlled GMP workshop area inside our 3,000 m² Suzhou facility supports higher-grade production needs.' },
  { icon: '🔬', t: 'HPLC / MS Analytical QC', d: 'Every batch is tested by HPLC and mass spectrometry, with analytical documentation and batch traceability.' },
  { icon: '🧬', t: 'Custom Peptide Synthesis', d: 'Solid-phase synthesis, purification and lyophilization — from a single sequence to modified and bulk projects.' },
  { icon: '🌐', t: 'Global Shipping Support', d: 'Export documentation, cold-chain packing and delivery estimates for international research clients.' },
];

// 首页明星产品：取 productLinks 前 6 个（站内真实产品页）
function renderFeaturedProducts() {
  const links = (SITE.productLinks || []).filter((p) => p.slug && !p.href).slice(0, 6);
  if (!links.length) return '';
  const bySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
  const cards = links.map((p) => {
    const pg = bySlug[p.slug];
    const title = pg ? (pg.title || p.label).split('|')[0].split('–')[0].trim() : p.label;
    const cat = pg && pg.category ? CAT_MAP[pg.category] : null;
    return `<a class="prod-card" href="/${esc(p.slug)}/">
      <div class="prod-card-top"><span class="prod-card-cat">${esc(cat ? cat.name : 'Research Peptide')}</span></div>
      <h3>${esc(title)}</h3>
      <p>${esc(pg && pg.excerpt ? pg.excerpt.slice(0, 110) : 'GMP-manufactured research peptide with batch traceability and wholesale pricing.')}</p>
      <span class="prod-card-link">View product →</span>
    </a>`;
  }).join('');
  return `<section class="home-featured"><div class="container">
    <div class="sec-head">
      <div><h2>Featured Research Peptides</h2><p class="sec-sub">Best-selling catalog items with standardized specifications and wholesale pricing.</p></div>
      <a class="btn btn-outline" href="/amp-peptide-product-list/">Full catalog & pricing</a>
    </div>
    <div class="prod-grid">${cards}</div>
  </div></section>`;
}

// 首页产品分类：读 categories.json + 各分类产品数
function renderHomeCategories() {
  const count = (slug) => pages.filter((p) => p.category === slug).length;
  // 首页只展示有产品的分类，按产品数降序；空分类保留在后台管理与归档页
  const cats = Object.values(CAT_MAP).filter((c) => count(c.slug) > 0).sort((a, b) => count(b.slug) - count(a.slug));
  if (!cats.length) return '';
  const cards = cats.map((c) => `<a class="cat-tile" href="/product-category/${esc(c.slug)}/">
      <span class="cat-tile-dot"></span>
      <span class="cat-tile-body">
        <b>${esc(c.name)}</b>
        <small>${count(c.slug)} product${count(c.slug) === 1 ? '' : 's'}</small>
      </span>
      <span class="cat-tile-arrow">→</span>
    </a>`).join('');
  return `<section class="home-cats"><div class="container">
    <div class="sec-head">
      <div><h2>Product Categories</h2><p class="sec-sub">Peptide reference materials organized by research area — from GLP-1 series to cosmetic and signaling compounds.</p></div>
      <a class="btn btn-outline" href="/amp-peptide-product-list/">All products & pricing</a>
    </div>
    <div class="cat-tile-grid">${cards}</div>
  </div></section>`;
}

function renderStats() {
  return `<section class="home-stats"><div class="container"><div class="stat-row">` +
    HOME_STATS.map((s) => `<div class="stat-cell"><b>${s.n}</b><span>${s.l}</span><small>${s.s}</small></div>`).join('') +
    `</div></div></section>`;
}

function renderAdvantages() {
  return `<section class="home-adv"><div class="container">
    <div class="sec-head"><div><h2>Why Customers Work with AMP Peptide</h2><p class="sec-sub">Practical manufacturing support — not just a quotation.</p></div></div>
    <div class="adv-grid">` +
    HOME_ADV.map((a) => `<div class="adv-card"><span class="adv-ico">${a.icon}</span><h3>${a.t}</h3><p>${a.d}</p></div>`).join('') +
    `</div></div></section>`;
}

function renderCtaBand() {
  return `<section class="cta-band"><div class="container cta-inner">
    <div><h2>Need a peptide quote?</h2><p>Send us your sequence, quantity and destination — our team replies with pricing, lead time and documentation.</p></div>
    <a class="btn btn-light" href="/contact/">Talk to our team →</a>
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

// 产品页顶部分类标签（后台「产品管理」里维护）
function catChip(entry) {
  if (!entry.category) return '';
  const cat = CAT_MAP[entry.category];
  const label = cat ? cat.name : entry.category;
  return `<p class="prod-cat-chip"><span>分类</span><a href="/amp-peptide-product-list/">${esc(label)}</a></p>`;
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
            <div class="hero-eyebrow">China-Based Peptide Manufacturer · Since 2012</div>
            <h1>${esc(h.title || SITE.fullName)}</h1>
            <p class="lead">${esc(h.subtitle || SITE.description)}</p>
            <div class="hero-cta">
              <a class="btn btn-light" href="/amp-peptide-product-list/">View products &amp; pricing</a>
              <a class="btn btn-ghost-light" href="/contact/">Request a quote</a>
            </div>
            <ul class="hero-trust">
              <li>GMP workshop</li><li>HPLC ≥98% purity</li><li>Batch traceability</li><li>Global shipping</li>
            </ul>
          </div>
        </div>
      </section>`
    : `<section class="page-hero"><div class="container">
        <div class="eyebrow">${esc(SITE.name)}</div>
        <h1>${esc(entry.title)}</h1>
      </div></section>`;
  const isHome = entry.slug === 'index';
  const homeTop = isHome ? renderStats() + renderHomeCategories() + renderFeaturedProducts() : '';
  const homeBottom = isHome ? renderAdvantages() + renderCtaBand() : '';
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
    .replace('{{BODY}}', hero + homeTop + catChip(entry) + `<article class="prose">${body}</article>` + homeBottom)
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

// ---- 分类归档页：/product-category/<slug>/ ----
function buildCategoryPage(cat) {
  const items = pages.filter((p) => p.category === cat.slug);
  const cards = items.map((p) => {
    const t = (p.title || p.slug).split('|')[0].split('–')[0].trim();
    return `<a class="cat-prod" href="/${esc(p.slug)}/">
      <b>${esc(t)}</b>
      ${p.excerpt ? `<small>${esc(p.excerpt.slice(0, 140))}</small>` : ''}
      <span>View product →</span>
    </a>`;
  }).join('');
  const entry = {
    title: cat.name + ' — AMP Peptide',
    description: (cat.description || cat.name) + ' Research peptides from AMP Peptide, a China-based GMP manufacturer. Wholesale supply with batch traceability.',
    slug: 'product-category/' + cat.slug,
    image: SITE.ogImage,
    type: 'page',
  };
  const bodyHtml = `<section class="page-hero"><div class="container">
        <div class="eyebrow">Product Category</div>
        <h1>${esc(cat.name)}</h1>
        ${cat.description ? `<p class="page-hero-sub">${esc(cat.description)}</p>` : ''}
      </div></section>
      <section class="cat-archive"><div class="container">
        ${items.length ? `<div class="cat-prod-grid">${cards}</div>` : '<p class="empty">该分类下暂无产品。</p>'}
        <p style="margin-top:26px"><a class="btn btn-primary" href="/amp-peptide-product-list/">← Back to full catalog &amp; pricing</a></p>
      </div></section>`;
  const html = readFileSync(join(ROOT, 'src', 'template.html'), 'utf8')
    .replace('{{TITLE}}', `<title>${esc(entry.title)}</title>`)
    .replace('{{META}}', `<meta name="description" content="${esc(entry.description)}"><link rel="canonical" href="${esc(urlFor(entry.slug))}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(entry.title)}"><meta property="og:image" content="${esc(SITE.url + SITE.ogImage)}">`)
    .replace('{{HEADER}}', renderHeader('amp-peptide-product-list'))
    .replace('{{BODY}}', bodyHtml)
    .replace('{{FOOTER}}', renderFooter())
    .replace('{{JSONLD}}', '');
  const op = join(DIST, 'product-category', cat.slug, 'index.html');
  mkdirSync(dirname(op), { recursive: true });
  writeFileSync(op, html);
  urls.push(urlFor(entry.slug));
}
for (const cat of Object.values(CAT_MAP)) buildCategoryPage(cat);


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
