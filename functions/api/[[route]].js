// AMP Peptide 网站后台 API（Cloudflare Pages Function）
// 代理 GitHub Contents API：后台的所有增删改查都通过这里完成，
// GitHub 令牌只存在服务端密钥里，浏览器永远接触不到。
//
// 路由（均为 /api/*）：
//   POST /api/login            { password }                      → 登录校验
//   GET  /api/list                                              → 列出 content/ 与媒体库文件
//   GET  /api/file?path=...                                     → 读取文件内容 + sha
//   POST /api/save             { path, content, message }        → 新建或更新文件（自动提交）
//   POST /api/delete           { path, message }                 → 删除文件
// 除 login 外，所有接口都需要请求头 x-admin-token: <管理密码>

const REPO = 'am2008-dot/ampeptide-static';
const BRANCH = 'main';
const GH_API = 'https://api.github.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const utf8ToBase64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const base64ToUtf8 = (b64) => {
  const bin = atob(String(b64 || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

// 允许操作的路径白名单：content 下的 md/json + 媒体库目录
const ALLOWED = /^(content\/[^/]+\.(md|json)|assets\/img\/uploads\/[^/]+\.(png|jpe?g|webp|gif|svg))$/i;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    // ---------- 登录 ----------
    if (route === 'login' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
        return json({ ok: false, error: '密码不正确，请重新输入' }, 401);
      }
      return json({ ok: true });
    }

    // ---------- 以下接口全部需要登录态 ----------
    if (!env.ADMIN_PASSWORD || request.headers.get('x-admin-token') !== env.ADMIN_PASSWORD) {
      return json({ ok: false, error: '未登录或会话已过期，请重新登录' }, 401);
    }
    if (!env.GITHUB_TOKEN) {
      return json({ ok: false, error: '服务端未配置 GITHUB_TOKEN 密钥，请联系管理员' }, 500);
    }

    const gh = async (path, opts = {}) => {
      const r = await fetch(GH_API + path, {
        ...opts,
        headers: {
          Authorization: 'Bearer ' + env.GITHUB_TOKEN,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'amppeptide-admin-function',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(opts.headers || {}),
        },
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }
      return { ok: r.ok, status: r.status, data };
    };

    // ---------- 文件列表 ----------
    if (route === 'list' && request.method === 'GET') {
      const { ok, data } = await gh(`/repos/${REPO}/git/trees/${BRANCH}?recursive=1`);
      if (!ok) return json({ ok: false, error: data.message || '读取仓库文件树失败' }, 502);
      const files = (data.tree || [])
        .filter((t) => t.type === 'blob')
        .map((t) => ({ path: t.path, size: t.size }))
        .filter((t) => ALLOWED.test(t.path));
      return json({ ok: true, files, truncated: !!data.truncated });
    }

    // ---------- 读取单个文件 ----------
    if (route === 'file' && request.method === 'GET') {
      const p = url.searchParams.get('path') || '';
      if (!ALLOWED.test(p)) return json({ ok: false, error: '非法路径' }, 400);
      const { ok, data } = await gh(`/repos/${REPO}/contents/${p}?ref=${BRANCH}`);
      if (!ok) return json({ ok: false, error: data.message || '文件不存在' }, 404);
      return json({ ok: true, path: p, sha: data.sha, content: base64ToUtf8(data.content) });
    }

    // ---------- 保存（新建或更新，自动判断） ----------
    if (route === 'save' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { path, content, message } = body;
      if (!path || typeof content !== 'string' || !ALLOWED.test(path)) {
        return json({ ok: false, error: '参数不完整或路径非法' }, 400);
      }
      // 已存在则带 sha 更新；不存在则新建
      const cur = await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`);
      const payload = {
        message: message || `后台更新: ${path}`,
        content: utf8ToBase64(content),
        branch: BRANCH,
      };
      if (cur.ok && cur.data && cur.data.sha) payload.sha = cur.data.sha;
      const { ok, data } = await gh(`/repos/${REPO}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!ok) return json({ ok: false, error: data.message || '保存失败' }, 502);
      return json({
        ok: true,
        commit: data.commit && data.commit.html_url,
        sha: data.content && data.content.sha,
      });
    }

    // ---------- 媒体上传（base64 直接落库） ----------
    if (route === 'upload' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { path, content, message } = body;
      if (!path || typeof content !== 'string' || !/^assets\/img\/uploads\/[^/]+\.(png|jpe?g|webp|gif|svg)$/i.test(path)) {
        return json({ ok: false, error: '参数不完整或路径非法' }, 400);
      }
      const cur = await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`);
      const payload = {
        message: message || `后台上传: ${path}`,
        content: content.replace(/^data:[^;]+;base64,/, ''),
        branch: BRANCH,
      };
      if (cur.ok && cur.data && cur.data.sha) payload.sha = cur.data.sha;
      const { ok, data } = await gh(`/repos/${REPO}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!ok) return json({ ok: false, error: data.message || '上传失败' }, 502);
      return json({ ok: true, path, commit: data.commit && data.commit.html_url });
    }

    // ---------- 删除 ----------
    if (route === 'delete' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { path, message } = body;
      if (!path || !/^content\/[^/]+\.md$/.test(path)) {
        return json({ ok: false, error: '只能删除 content 下的 .md 文件' }, 400);
      }
      const cur = await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`);
      if (!cur.ok) return json({ ok: false, error: '文件不存在' }, 404);
      const { ok, data } = await gh(`/repos/${REPO}/contents/${path}`, {
        method: 'DELETE',
        body: JSON.stringify({
          message: message || `后台删除: ${path}`,
          sha: cur.data.sha,
          branch: BRANCH,
        }),
      });
      if (!ok) return json({ ok: false, error: data.message || '删除失败' }, 502);
      return json({ ok: true, commit: data.commit && data.commit.html_url });
    }

    return json({ ok: false, error: '未知接口: ' + route }, 404);
  } catch (e) {
    return json({ ok: false, error: '服务端异常: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
}
