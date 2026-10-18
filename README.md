# AMP Peptide 静态站（amppeptide.com 克隆）

从 `amppeptide.com`（WordPress）克隆生成的**静态、响应式**网站。前台内容 1:1 复制，后台为**中文 Decap CMS**，可一键部署到 Cloudflare Pages。

## 技术栈
- 纯静态 HTML（构建输出在 `dist/`，**零运行时依赖**，无需 `npm install`）
- 内容以 Markdown 存放于 `content/pages/*.md` 与 `content/posts/*.md`
- 构建：`node src/build.mjs`（Markdown → 带 SEO 的静态页，干净 URL `/<slug>/`）
- 后台：Decap CMS（`admin/`，中文界面），通过 GitHub 提交内容并触发重新构建

## 本地预览
```bash
npm run build      # 生成 dist/
npm run preview    # 打开 http://localhost:4173
```

## 内容管理（中文后台）
1. 部署后访问 `https://你的域名/admin/`
2. 用 GitHub 账号登录（OAuth）
3. 在「页面 / 博客文章 / 站点设置」中编辑内容，保存即提交到 GitHub
4. 推送触发 Cloudflare Pages 重新构建，站点自动更新

### 后台登录所需的 GitHub OAuth App（唯一需手动一步）
Decap 通过 GitHub OAuth 登录，需在 GitHub 注册一个 OAuth App（GitHub 平台限制，无法用 API 自动创建）：
1. 打开 https://github.com/settings/developers → **New OAuth App**
2. **Application name：** `AMP Peptide CMS`
3. **Homepage URL：** `https://amppeptide.com`
4. **Authorization callback URL：** `https://amppeptide.com/admin/`
5. 创建后复制 **Client ID**，粘贴到 `admin/config.yml` 的 `backend.client_id`（替换 `PASTE_GITHUB_OAUTH_CLIENT_ID_HERE`）
6. 若先用 `*.pages.dev` 预览，可把回调 URL 暂改为 `https://<项目名>.pages.dev/admin/`

> 已绑定自定义域名后，回调填 `https://amppeptide.com/admin/` 即可。Decap 3.x 用 PKCE，无需客户端密钥。

## 部署到 Cloudflare Pages（推荐：连接 GitHub）
1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
2. 选择仓库 `am2008-dot/amppeptide-static`
3. 构建设置：
   - **Build command：** `node src/build.mjs`
   - **Output directory：** `dist`
   - Node.js 版本：22（默认即可）
4. 保存并部署。之后每次 `git push` 自动构建发布。
5. （可选）**Custom domains** 绑定 `amppeptide.com` 并配置 DNS。

### 手动部署（可选）
```bash
npx wrangler pages deploy dist --project-name=amppeptide-static
```

## 目录结构
- `content/` 内容源（页面 / 文章 / 站点配置）—— **后台编辑的就是这里**
- `src/` 构建脚本（Markdown 解析、HTML 模板、生成器）
- `assets/` 样式、脚本、图片（含本地化后的 `uploads/`）
- `admin/` Decap CMS 后台
- `dist/` 构建产物（自动生成，勿手动修改）

## SEO 与合规
- 每页含 `<title>` / `description` / `canonical` / OpenGraph / Twitter / JSON-LD（Organization / Article / WebPage）
- 自动生成 `sitemap.xml` 与 `robots.txt`（已放行，仅屏蔽 `/admin/`）
- 前台内容为英文（与原文一致），后台界面为中文。

## 重新抓取线上内容（可选）
如需从线上 WordPress 重新同步文章/页面内容：
```bash
npm run ingest    # 读取站点 sitemap 的 .md 导出，写入 content/，并本地化图片
npm run build
```
