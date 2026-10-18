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

## 部署到 Cloudflare Pages（已完成 ✅）

站点已通过 `wrangler pages deploy` 发布到 Cloudflare Pages：
- **生产地址：** https://amppeptide-static.pages.dev （生产部署，对应 `main` 分支）
- 项目名：`amppeptide-static`（账号：`Am2008@gmail.com's Account`）

### 实现「git push 自动部署」的两种方式（二选一，均需你在控制台点一下）

**方式 A — Cloudflare 直连 Git（最简单，推荐）**
1. Cloudflare Dashboard → **Workers & Pages → amppeptide-static → Settings → Builds & deployments → Connect GitHub repository**
2. 选择仓库 `am2008-dot/amppeptide-static`，设分支 `main`
3. 构建设置：**Build command = `node src/build.mjs`**，**Output directory = `dist`**
4. 保存。之后每次 `git push` 自动构建发布。

**方式 B — GitHub Actions（已内置工作流，需一个 Token 密钥）**
仓库已含 `.github/workflows/deploy.yml`，只要在 GitHub 仓库加一个 Secret 即可全自动化：
1. Cloudflare Dashboard → **My Profile → API Tokens → Create Token** → 用模板 **"Cloudflare Pages: Edit"**（或自定义：Account 下 Pages 的 Edit 权限，资源限定本项目）
2. 复制生成的 Token
3. GitHub 仓库 **Settings → Secrets → Actions → New repository secret**：
   - Name：`CF_API_TOKEN`，Value：上面复制的 Token
4. 之后每次 `git push` 自动部署（无需连 Git）。

> 注：当前 Cloudflare 登录用的是本机保存的 OAuth token，它没有"创建 API Token"的权限，所以方式 B 的 Token 需你在控制台手动生成一次。方式 A 则完全无需 Token。

### 手动部署（随时可重跑）
```bash
npx wrangler pages deploy dist --project-name=amppeptide-static --branch=main --commit-dirty=true
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
