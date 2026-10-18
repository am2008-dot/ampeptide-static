// Minimal but capable Markdown -> HTML converter for the AMP Peptide static site.
// Supports: headings, bold/italic/strikethrough, inline code, links, images,
// unordered/ordered lists, blockquotes, fenced code, horizontal rules,
// GFM pipe tables, and pass-through of raw HTML blocks.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text) {
  let t = escapeHtml(text);
  // images
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (m, alt, url, title) => `<img src="${url}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`);
  // links
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (m, txt, url, title) => {
      const ext = /^https?:\/\//.test(url);
      return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}${title ? ` title="${title}"` : ''}>${txt}</a>`;
    });
  // bold
  t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
  // italic
  t = t.replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^_])_([^_\n]+?)_/g, '$1<em>$2</em>');
  // strikethrough
  t = t.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
  // inline code
  t = t.replace(/`([^`]+?)`/g, '<code>$1</code>');
  return t;
}

function splitRow(line) {
  let s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return s.split('|').map(c => c.trim());
}

const isTableSep = l => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes('-') && l.includes('|');

const BLOCK_START = /^#{1,6}\s|^>\s|^```|^\s*[-*+]\s|^\s*\d+\.\s|^<[a-zA-Z/!]|^\s*([-*_])(\s*\1){2,}\s*$/;

export function mdToHtml(md) {
  md = (md || '').replace(/\r\n/g, '\n');
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    // fenced code
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      out.push('<pre><code>' + escapeHtml(buf.join('\n')) + '</code></pre>');
      continue;
    }

    // raw HTML block pass-through
    if (/^\s*<[a-zA-Z/!]/.test(line)) {
      const buf = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\s|^>\s|^```|^\s*[-*+]\s|^\s*\d+\.\s/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      out.push(buf.join('\n'));
      continue;
    }

    // heading
    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      const lvl = hm[1].length;
      const txt = hm[2].trim();
      const anchor = txt.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      out.push(`<h${lvl} id="${anchor}">${inline(txt)}</h${lvl}>`);
      i++; continue;
    }

    // horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push('<blockquote>' + mdToHtml(buf.join('\n')) + '</blockquote>');
      continue;
    }

    // table
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim() !== '') { rows.push(splitRow(lines[i])); i++; }
      let t = '<div class="table-wrap"><table><thead><tr>' + header.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
      for (const r of rows) t += '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
      t += '</tbody></table></div>';
      out.push(t);
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
      out.push('<ul>' + buf.map(b => `<li>${inline(b)}</li>`).join('') + '</ul>');
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push('<ol>' + buf.map(b => `<li>${inline(b)}</li>`).join('') + '</ol>');
      continue;
    }

    // paragraph
    const buf = [];
    while (
      i < lines.length && lines[i].trim() !== '' && !BLOCK_START.test(lines[i]) &&
      !(lines[i].trim().startsWith('|') && lines[i + 1] && isTableSep(lines[i + 1]))
    ) {
      buf.push(lines[i]); i++;
    }
    if (buf.length) out.push('<p>' + inline(buf.join(' ')) + '</p>');
  }

  return out.join('\n');
}
