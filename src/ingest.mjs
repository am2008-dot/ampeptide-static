// Ingest: fetch the live amppeptide.com Markdown exports, augment frontmatter,
// localize images, and write content/pages + content/posts for the static build.
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, dumpFrontmatter } from './frontmatter.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONTENT = join(ROOT, 'content');
const BASE = 'https://amppeptide.com';

function curl(url, timeout = 35) {
  try {
    return execSync(`curl -sL -k --max-time ${timeout} ${JSON.stringify(url)}`, { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
  } catch (e) { return ''; }
}

function localPath(iu) {
  const u = new URL(iu);
  let p = u.pathname.replace(/^\/wp-content\/uploads\//, '').replace(/\?.*$/, '');
  return '/assets/img/uploads/' + p;
}

const sitemaps = [curl(BASE + '/page-sitemap.xml'), curl(BASE + '/post-sitemap.xml')].join('\n');
const urls = [...new Set([...sitemaps.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]))];
console.log(`Found ${urls.length} URLs in sitemaps`);

const imgMap = {};
let done = 0, skipped = 0, errored = 0;

for (const url of urls) {
  try {
    const isHome = url === BASE + '/';
    const slugFromUrl = new URL(url).pathname.replace(/^\/|\/$/g, '');
    const mdUrl = isHome ? BASE + '/index.md' : BASE + '/' + slugFromUrl + '.md';
    const md = curl(mdUrl);
    if (!md || /^<!DOCTYPE|^<html/i.test(md.trim())) { console.log('SKIP (no .md):', url); skipped++; continue; }
    const { data, body } = parseFrontmatter(md);
    const outSlug = isHome ? 'index' : (data.slug || slugFromUrl);
    const type = data.type === 'post' ? 'post' : 'page';
    const folder = type === 'post' ? 'posts' : 'pages';
    const description = (data.excerpt || '').replace(/^"|"$/g, '');
    const entry = {
      title: (data.title || '').replace(/^"|"$/g, ''),
      description,
      type,
      slug: outSlug,
      image: '/assets/img/og-image.jpg',
      canonical: data.url || url,
      excerpt: data.excerpt || '',
      date: data.published_at || '',
      modified: data.modified_at || ''
    };
    if (data.taxonomy_category) entry.category = data.taxonomy_category;

    let bodyOut = body;
    const imgs = [
      ...bodyOut.matchAll(/!\[[^\]]*\]\((https:\/\/amppeptide\.com\/wp-content\/uploads\/[^)\s]+)\)/g),
      ...bodyOut.matchAll(/<img[^>]+src=["'](https:\/\/amppeptide\.com\/wp-content\/uploads\/[^"']+)["']/g)
    ].map(m => m[1]);
    for (const iu of imgs) {
      const local = localPath(iu);
      imgMap[iu] = local;
      bodyOut = bodyOut.split(iu).join(local);
    }

    mkdirSync(join(CONTENT, folder), { recursive: true });
    const outFile = join(CONTENT, folder, outSlug + '.md');
    if (existsSync(outFile) && statSync(outFile).size > 200) { console.log('EXISTS', folder, '/', outSlug); skipped++; continue; }
    writeFileSync(outFile, '---\n' + dumpFrontmatter(entry) + '---\n\n' + bodyOut.trim() + '\n');
    console.log('OK', folder, '/', outSlug);
    done++;
  } catch (e) {
    errored++;
    console.log('ERR processing', url, '->', e.message);
  }
}
console.log(`\nMarkdown phase: ${done} written, ${skipped} skipped/existing, ${errored} errored`);

console.log(`\nLocalizing ${Object.keys(imgMap).length} images...`);
let ok = 0, fail = 0;
for (const [iu, local] of Object.entries(imgMap)) {
  const dest = join(ROOT, local.replace(/^\//, ''));
  if (existsSync(dest)) { ok++; continue; }
  mkdirSync(dirname(dest), { recursive: true });
  try {
    execSync(`curl -sL -k --max-time 60 -o ${JSON.stringify(dest)} ${JSON.stringify(iu)}`);
    ok++;
  } catch (e) { fail++; console.log('  img FAIL', iu); }
}
console.log(`Images: ${ok} ok, ${fail} failed`);
console.log('✅ Ingest complete. Run: npm run build');
