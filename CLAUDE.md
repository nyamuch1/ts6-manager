# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

TS6 Manager 是 TeamSpeak 服务器的 Web 管理界面（虚拟服务器、频道、客户端、权限、音乐/视频机器人、自动化流程、可嵌入 Widget）。它是 [`clusterzx/ts6-manager`](https://github.com/clusterzx/ts6-manager) 的独立延续版本，不是镜像。

pnpm monorepo，四个包：

| 包 | 职责 |
|---|---|
| `@ts6/common` | 共享类型、常量、工具函数（编译到 `dist/`） |
| `@ts6/backend` | Express API、WebQuery/SSH 客户端、Bot 流程引擎、语音机器人、Widget |
| `@ts6/frontend` | React SPA（Vite + Tailwind + Radix/shadcn 风格组件） |
| `packages/sidecar` | Go/Pion WebRTC 媒体中继（视频流），无 package.json |

核心信任边界：前端从不接触 TeamSpeak API Key 或服务器凭据；所有 TeamSpeak 调用都经后端代理。媒体 sidecar 是内部服务（默认 `:9800`，Bearer `SIDECAR_SECRET`），不应直接暴露。`/widget/:token` 是唯一按设计无需登录的公开路径。

## 常用命令

环境要求：Node.js 20+、pnpm 9.x（CI 固定 pnpm 9；不要用更新的 pnpm major 做本地验证）。

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm db:generate                          # 生成 Prisma Client 到 packages/backend/generated
pnpm --filter @ts6/common build           # frontend/backend 的类型解析依赖其 dist
pnpm dev                                  # 并行启动 backend :3001 + frontend :5173
```

| 命令 | 作用 |
|---|---|
| `pnpm dev:backend` / `pnpm dev:frontend` | 只启动单个开发服务 |
| `pnpm build` | 按拓扑顺序构建所有包（不含 Go sidecar） |
| `pnpm typecheck` | 全工作区类型检查（clean checkout 需先 build common） |
| `pnpm db:seed` | 写入默认 app settings；**不创建管理员**，首次使用访问 `/setup` |
| `pnpm audit` | 审计生产依赖 |
| `./scripts/ci/repo-hygiene.sh` | CRLF/shell 语法/compose 校验（需要 docker、python3） |
| `python3 scripts/ci/check-docs-layout.py` | 文档目录、slug、相对链接校验 |

仓库没有 ESLint 配置，也没有任何包定义 `lint` 脚本，`pnpm lint` 实际不执行检查；以 `pnpm typecheck` 和 `pnpm build` 为准。

根目录 `.env` 由 `packages/backend/src/config.ts` 加载（不是 `packages/backend/.env`）。本地完整栈（含 TeamSpeak 6 beta13）优先用：

```bash
cp .env.pr-test.example .env
docker compose -f docker-compose.pr-test.yml up --build   # 打开 http://localhost:3000/setup
```

只要管理器（不含 TeamSpeak 容器）：`docker compose -f docker-compose.local.yml up -d --build`。

## 测试

**后端**（与源码同目录的 `src/**/*.test.ts`，使用 `node:test` + `tsx`）：

```bash
cd packages/backend
pnpm exec tsx --test src/routes/channel-banners.test.ts        # 单个文件
mapfile -t t < <(find src -name '*.test.ts' | sort); pnpm exec tsx --test "${t[@]}"  # 全部
```

路由测试的惯例是自建 Express app，并通过 `app.locals.prisma` 注入 mock Prisma 对象（生产代码在 `index.ts` 中把真实 client 挂到同一位置）。测试文件被 `tsconfig.json` 排除在构建之外。

**前端单元测试**（`tests/unit/*.test.ts`）：

```bash
pnpm --filter @ts6/frontend test:unit
pnpm --filter @ts6/frontend exec tsx --test tests/unit/action-guidance.test.ts   # 单个
```

**前端 Playwright**（`tests/*.spec.ts`，`testIgnore` 排除 `unit/`）：测试服务器 `tests/serve-production.mjs` 提供的是 `dist/`，因此必须先构建。

```bash
pnpm --filter @ts6/frontend build
pnpm --filter @ts6/frontend test
pnpm --filter @ts6/frontend exec playwright test tests/channels.spec.ts   # 单个
```

**Go sidecar**（在 `packages/sidecar`）：

```bash
go test -race ./...
go vet ./...
SIDECAR_FFMPEG_IT=1 go test -race ./...    # 额外的 FFmpeg 集成测试
SIDECAR_SKIP_ARCHIVE=1 ./scripts/sidecar/build-release.sh 0.0.0-pr /tmp/out  # 交叉编译检查
```

文档截图：`pnpm --filter @ts6/frontend docs:screenshots` 只重新生成 fixture 截图；`channels.png`、`clients.png` 等 Demo 服务器截图必须按 `docs/public/development.md` 手工从 Demo 连接捕获。CI 的完整门禁见 `.github/workflows/pr-validation.yml`。

## 架构要点

请求流：浏览器 →（nginx 或 Vite dev proxy）→ Express `/api` → TeamSpeak WebQuery（HTTP 管理）+ SSH Query（事件流）→ SQLite；视频/音频媒体经 Go sidecar 以 WebRTC/RTP 转发。

**后端** (`packages/backend/src`)：

- `index.ts` 组装运行时：Prisma、`app.locals.prisma`、HTTP/WebSocket 服务（`/ws`，JWT 校验）、`ConnectionPool`、`BotEngine`、`VoiceBotManager`、IPTV 调度、审计保留、优雅关闭。`app.ts` 只负责 Express 中间件和路由挂载。
- `ts-client/`：WebQuery HTTP 客户端与队列、SSH Query 事件客户端、连接池/诊断、Demo 服务器客户端、Prometheus 指标解析。
- `bot-engine/`：事件桥、流程运行器（节点图）、命令白名单、延迟限流、临时频道归属。
- `voice/`：语音机器人生命周期、TS3 语音协议（UDP/Opus）、音频下载与媒体缓存、yt-dlp/FFmpeg、出站检查代理、播放列表、Listener Remote。
- 其他：`iptv/`（M3U 播放列表与调度）、`widget/`（SVG/PNG 公开 Widget）、`audit/`、`activity-journal/`、`routes/`（每个领域一个 `*.routes.ts`）。
- 认证：JWT access + refresh 轮换；角色仅 `admin` / `viewer`（`@ts6/common` 的 `UserRole`）。`authMiddleware` 每次请求都从数据库重新读取 `enabled`/`role`；`requireServerAccess` 对非 admin 强制 `UserServerAccess`，admin 绕过。

**前端** (`packages/frontend/src`)：

- `App.tsx` 用 React Router 懒加载页面，`AdminRoute` 做角色门禁；TanStack Query 负责服务端状态（mutation 设置为离线即失败、不重放）；Zustand 管理 `auth`/`server`/`ui`/`media-switch` 状态。
- `api/client.ts` 是唯一的 axios 实例（`baseURL: '/api'`），在请求前按 JWT `exp` 提前刷新，并用 Web Locks 保证多标签页只刷新一次。
- Vite 别名 `@` → `src`；`server.proxy` 把 `/api` 和 `/ws` 转到 `:3001`。
- PWA 使用 `vite-plugin-pwa` 的 `injectManifest`（`packages/frontend/pwa/sw.ts`）。只有构建产物进入 Cache Storage，没有运行时缓存；维护约束见 `docs/internal/pwa-maintenance.md`。
- 文档截图 fixture 和 `ui.store.ts` 的侧栏版本号有联动，改默认折叠状态时要同步 `COMPACT_SIDEBAR_DEFAULTS_VERSION`。

**Sidecar** (`packages/sidecar`)：Go + Pion，用 FFmpeg 拉流并编码为 WebRTC RTP。版本由 `version.txt` 在构建时注入；后端会比较双方版本，发布时必须与后端同版本。原生（非 Docker）sidecar 用于 Windows AMF / macOS VideoToolbox，文档见 `docs/public/native-sidecar.md`。

## 数据库

Prisma + SQLite。Client 生成到 `packages/backend/generated/`（git 忽略）。

- 本地首次运行：`cd packages/backend && npx prisma db push && npx prisma db seed`。
- 生产容器每次启动运行 `docker-commands/apply-schema.sh`，用 `prisma db push` 升级（无迁移历史），并记录 `data/.schema-version`。
- `packages/backend/prisma/migrations/` 被 git 忽略；修改 `schema.prisma` 时同步更新 `packages/backend/prisma/SCHEMA_VERSION`，否则升级日志会不准确。

## 国际化（i18n）

- 前端使用 `i18next` + `react-i18next`。语言文件在 `packages/frontend/src/i18n/locales/{en,zh-CN}/<namespace>.json`，`en` 是源语言；组件里用 `useTranslation('<namespace>')` 和 `t('key')`，跨命名空间用 `t('common:action.save')`。不要拼接翻译片段，用 `{{name}}` 插值。
- 语言偏好保存在 `ui.store`（`language: 'system' | 'en' | 'zh-CN'`，localStorage key `ts6-ui`）；`LanguageSync` 负责同步 i18next、`<html lang>`，并在切换时让 TanStack Query 失效以重新获取服务端本地化文本。
- `api/client.ts` 的请求拦截器发送 `Accept-Language`；后端 `packages/backend/src/i18n/` 用 `negotiateLocale` + `translate` 本地化 HTTP 错误、诊断文本、Widget 输出和机器人聊天。默认 `en`，英文输出保持与原硬编码字符串一致。
- 翻译键一致性由 `scripts/ci/check-i18n.py` 检查（键集合、占位符、空值、重复键），已加入 `scripts/ci/repo-hygiene.sh`；后端字典由 `packages/backend/src/i18n/i18n.test.ts` 检查。
- 新增语言：添加前端 locale 目录并在 `src/i18n/index.ts` 注册，扩展 `src/i18n/languages.ts` 与后端 `SUPPORTED_LOCALES`，补齐所有键，然后运行 `python3 scripts/ci/check-i18n.py`。中文术语保持一致（频道、客户端、查询、机器人）。

## 文档

| 路径 | 用途 |
|---|---|
| `docs/public/` | 发布到 uniskela.com 的指南 |
| `docs/manifest.json` | 决定哪些页面发布、slug 和分组 |
| `docs/internal/` | 实现计划/维护者笔记，不发布 |
| `docs/agents/` | 代理工作笔记，不发布 |

规则：公开 URL slug 必须稳定（`/docs/ts6-manager/latest/<slug>/`）；`docs/internal/`、`docs/agents/` 不得进入 manifest，`docs/public/` 页面也不得链接到它们（`scripts/ci/check-docs-layout.py` 会检查）。`README.md` 中 Docker Hub 用的节选由 `scripts/ci/dockerhub-readme.py` 按固定标题生成，重命名 `SECTIONS` 中的标题会同时改脚本。

## 发布（Release Please）

- 功能 PR 用 Conventional Commits 作为 squash/merge 标题：`fix:` → patch，`feat:` → minor，`feat!:` / `BREAKING CHANGE:` → major，`chore:`/`docs:`/`ci:`/`test:` 不单独发版。
- **不要**在功能 PR 手工修改版本号、`version.txt` 或 `app-version.ts`；Release Please 的 release PR 负责。
- 需要指定版本时，把 `Release-As: X.Y.Z` 放在落到 `main` 的 commit **body**（不是标题）。
- 只有 release PR 合并、GitHub Release 创建后才会发布镜像；普通 push 到 `main` 不发布。发布同时产出五个 `ts6-media-sidecar_*` 归档和 `SHA256SUMS`。
- 合并 release PR 前，对照当前 `main` 清理 changelog：删除已回滚的条目、合并重复描述。这一步要在最后一个预发布 PR 之后做，因为 Release Please 刷新会覆盖手工编辑。

## 依赖与仓库约束

- `pnpm.overrides`（根 `package.json`）必须保留在 `pnpm-lock.yaml` 中。Dependabot 的 pnpm 组 PR 若报 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`，应关闭该 PR，在人工分支上用 pnpm 9 执行 `pnpm install` 重建，而不要放宽 `--frozen-lockfile`。`scripts/ci/check-pnpm-overrides.py` 会在 CI 中检查。
- 不要提交构建产物：`bin/`、`dist/`、`packages/backend/generated/`、数据库和 `.env` 均已忽略。
- 其他代理规则：`AGENTS.md`（发布流程、ADHD Hub 连续性）和 `.cursor/rules/adhd-hub.mdc`。进行实质性工作前按其中要求检查 Hub MCP；不可用时不得虚构 Hub 状态或写入成功。
