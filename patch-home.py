import re

p = 'src/build.mjs'
s = open(p, encoding='utf-8').read()

old_hero = """  const hero = entry.slug === 'index'
    ? `<section class="hero">
        <div class="hero-cover" style="background-image:url('${esc(SITE.hero.image || SITE.pageHeroBg)}')">
          <div class="hero-dim"></div>
          <div class="container hero-inner">
            <h1>${esc(h.title || SITE.fullName)}</h1>
            <p class="lead">${esc(h.subtitle || SITE.description)}</p>
          </div>
        </div>
      </section>`"""
new_hero = """  const hero = entry.slug === 'index'
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
      </section>`"""
assert s.count(old_hero) == 1, 'hero pattern not found'
s = s.replace(old_hero, new_hero)

old_asm = "  const homeCats = entry.slug === 'index' ? renderHomeCategories() : '';"
new_asm = (
    "  const isHome = entry.slug === 'index';\n"
    "  const homeTop = isHome ? renderStats() + renderHomeCategories() + renderFeaturedProducts() : '';\n"
    "  const homeBottom = isHome ? renderAdvantages() + renderCtaBand() : '';"
)
assert s.count(old_asm) == 1, 'asm pattern not found'
s = s.replace(old_asm, new_asm)

old_body = """    .replace('{{BODY}}', hero + homeCats + catChip(entry) + `<article class="prose">${body}</article>`)"""
new_body = """    .replace('{{BODY}}', hero + homeTop + catChip(entry) + `<article class="prose">${body}</article>` + homeBottom)"""
assert s.count(old_body) == 1, 'body pattern not found'
s = s.replace(old_body, new_body)

open(p, 'w', encoding='utf-8').write(s)
print('homepage assembly updated OK')
