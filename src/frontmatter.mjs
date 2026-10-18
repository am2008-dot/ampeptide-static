// Shared YAML-frontmatter (single level + simple lists) parser/dumper for content/*.md
export function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const fm = m[1];
  const body = m[2];
  const data = {};
  let listKey = null;
  for (const line of fm.split(/\r?\n/)) {
    if (/^\s*-\s+/.test(line) && listKey) {
      data[listKey].push(line.trim().replace(/^-\s+/, '').replace(/^"|"$/g, ''));
      continue;
    }
    listKey = null;
    const mm = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (mm) {
      const k = mm[1];
      let v = mm[2].trim();
      if (v === '') { data[k] = []; listKey = k; continue; }
      data[k] = v.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
  }
  return { data, body };
}

export function dumpFrontmatter(data) {
  let out = '';
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) {
      out += `${k}:\n`;
      for (const it of v) out += `  - "${String(it).replace(/"/g, '\\"')}"\n`;
    } else {
      out += `${k}: "${String(v).replace(/"/g, '\\"')}"\n`;
    }
  }
  return out;
}
