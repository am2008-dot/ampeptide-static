# AMP Peptide 静态站（amppeptide.com 克隆）

从 `amppeptide.com`（WordPress）克隆生成的**静态、响应式**网站。前台内容 1:1 复制，后台为**自建中文 CMS**（密码登录 + Pages Function 代理 GitHub API），可一键部署到 Cloudflare Pages。

## 技术栈
- 纯静态 HTML（构建输出在 `dist/`，**零运行时依赖**，无需 `npm install`）
- 内容以 Markdown 存放于 `content/pages/*.md` 与 `content/posts/*.md`，站点配置在 `content/_site.json`
- 构建：`node src/build.mjs`（Markdown → 带 SEO 的静态页，干净 URL `/<slug>/`）
- 后台：自建 CMS（`admin/index.html` + `functions/api/[[route]].js`），密码登录后直接读写 GitHub 仓库内容

## 本地预览
```bash
npm run build      # 生成 dist/
npm run preview    # 打开 http://localhost:4173
```

## 内容管理（中文后台）

1. 访问 `https://amppeptide-static.pages.dev/admin/`
2. 输入管理密码登录（密码存在 Cloudflare Pages 密钥 `ADMIN_PASSWORD` 里，浏览器只持有登录态）
3. 在「页面 / 博客文章 / 站点设置 / 媒体库」中编辑，保存即提交到 GitHub 仓库
   `am2008-dot/ampeptide-static`（main 分支），提交信息为「后台更新: <路径>」
4. 推送触发重新构建，站点自动更新（见下方「自动部署」）

> 后台全部接口走 `/api/*`（Pages Function），GitHub 令牌只存在服务端密钥
> `GITHUB_TOKEN` 里，浏览器永远接触不到。除登录外所有接口都需要 `x-admin-token` 头。
> 可操作路径白名单：`content/**/*.md|json` 与 `assets/img/uploads/*`（含图片），
> 已防 `..` 目录穿越。

### 改后台密码（一条命令）

```bash
printf '%s' '新密码' | npx wrangler pages secret put ADMIN_PASSWORD --project-name=amppeptide-static
# 然后重新部署一次（`bash deploy.sh`），密钥才会绑定到运行时
```

## 部署到 Cloudflare Pages（已完成 ✅）

站点已通过 `wrangler pages deploy` 发布到 Cloudflare Pages：
- **生产地址：** https://amppeptide-static.pages.dev （生产部署，对应 `main` 分支）
- 项目名：`amppeptide-static`（账号：`Am2008@gmail.com's Account`）
- 项目已配好 Functions 兼容性：`compatibility_date = 2025-04-01` + `nodejs_compat`
  （写在 `wrangler.toml`，同时也写进了项目设置，Git 构建路径同样生效）
- 本机一键部署：`bash deploy.sh`（内含代理/TLS 补丁；wrangler 走托管 node workspace）

### 实现「后台保存 → 网站自动重建」的闭环（二选一）

后台保存只是把内容提交到 GitHub，**线上站点要重新构建才会更新**。GitHub Actions
工作流（`.github/workflows/deploy.yml`）已就绪，但仓库里还缺 `CF_API_TOKEN` 密钥
（本机保存的是 Cloudflare OAuth 令牌，没有创建 API Token 的权限，需在控制台手动生成一次）：

**方式 A — Cloudflare 直连 Git（最简单，推荐）**
1. Cloudflare Dashboard → **Workers & Pages → amppeptide-static → Settings → Builds & deployments → Connect GitHub repository**
2. 选择仓库 `am2008-dot/ampeptide-static`，设分支 `main`
3. 构建设置：**Build command = `node src/build.mjs`**，**Output directory = `dist`**
4. 保存。之后每次 `git push` 自动构建发布，无需任何 Token
5. 接上 Git 后 GitHub Actions 工作流就多余了，可删除 `.github/workflows/deploy.yml`

**方式 B — GitHub Actions + CF_API_TOKEN**
1. Cloudflare Dashboard → **My Profile → API Tokens → Create Token** → 模板 **"Cloudflare Pages: Edit"**
2. GitHub 仓库 **Settings → Secrets and variables → Actions → New repository secret**：
   Name：`CF_API_TOKEN`，Value：上面复制的 Token
3. 之后每次 `git push` 自动部署

### 手动部署（随时可重跑）
```bash
bash deploy.sh
# 或等价地：
npx wrangler pages deploy dist --project-name=amppeptide-static --branch=main --commit-dirty=true
```

## 目录结构
- `content/` 内容源（页面 / 文章 / 站点配置）—— **后台编辑的就是这里**
- `src/` 构建脚本（Markdown 解析、HTML 模板、生成器）
- `assets/` 样式、脚本、图片（含本地化后的 `uploads/`）
- `admin/` 自建中文后台（登录页 + 编辑器，配合 `functions/api/`）
- `functions/` Pages Function：后台 API（代理 GitHub Contents API，令牌只在服务端）
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
