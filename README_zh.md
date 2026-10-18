[English](README.md) | **简体中文**

#### 免责声明：
![AI 辅助](https://img.shields.io/badge/AI%20Assisted-Project-00ADD8?style=for-the-badge&logo=dependabot&logoColor=white)

# TS6 Manager

> [!IMPORTANT]
> **这是 [`clusterzx/ts6-manager`](https://github.com/clusterzx/ts6-manager) 的一个有明确取舍的延续版本，不是上游的镜像或可直接替换的重新发布版。**
> 请预期以安全性和可靠性为重点的改动、部分体验优化，以及不同的容器镜像（`ghcr.io/uniskela/ts6-manager/...`；配置了 Hub 发布密钥后，也会同步到 Docker Hub 的 `uniskela/ts6-manager:<component>`）。
> 社区 issue/PR 致谢见 [`CREDITS.md`](CREDITS.md)（包含 [fork 贡献](CREDITS.md#fork-contributions)）。

TeamSpeak 服务器的 Web 管理界面。在浏览器中管理虚拟服务器、频道、客户端、权限、音乐机器人、自动化工作流和可嵌入的服务器小组件。

**为社区而构建。** TS6 Manager 是一个独立的 FOSS 项目，由热爱 TeamSpeak 和自托管的贡献者维护。开发由用户和贡献者的需求驱动，而不是商业产品或托管服务。

基于 **WebQuery HTTP API**（现代 TeamSpeak 构建中 ServerQuery 的替代方案）。不使用也不支持 Telnet。

![许可证](https://img.shields.io/badge/license-MIT-blue)

**目录：** [文档](#文档) · [AI 代理文档](#在-ai-编码代理中使用本项目) · [截图](#截图) · [功能](#功能) · [架构](#架构) · [技术栈](#技术栈) · [快速开始（Docker）](#快速开始docker) · [开发](#开发) · [环境变量](#环境变量) · [Sidecar / 视频串流环境变量](#环境变量sidecar--视频串流) · [媒体机器人文本命令](#媒体机器人文本命令) · [要求](#要求) · [TeamSpeak 兼容性](#teamspeak-兼容性与-beta13-设置) · [下载进度](#下载进度) · [许可证](#许可证)

## 文档

维护中的公开文档位于 **[www.uniskela.com/docs/ts6-manager](https://www.uniskela.com/docs/ts6-manager/)**，内容来自 [`docs/public/`](docs/public/index.md) 中经过审阅的 Markdown 文件。

建议从以下页面开始：

- [安装](https://www.uniskela.com/docs/ts6-manager/latest/installation/)
- [配置](https://www.uniskela.com/docs/ts6-manager/latest/configuration/)
- [升级](https://www.uniskela.com/docs/ts6-manager/latest/upgrading/)
- [TeamSpeak 兼容性](https://www.uniskela.com/docs/ts6-manager/latest/teamspeak-compatibility/)
- [媒体机器人](https://www.uniskela.com/docs/ts6-manager/latest/music-bots/)
- [机器人流程](https://www.uniskela.com/docs/ts6-manager/latest/bot-flows/)
- [安全](https://www.uniskela.com/docs/ts6-manager/latest/security/)
- [故障排查](https://www.uniskela.com/docs/ts6-manager/latest/troubleshooting/)
- [视频串流](https://www.uniskela.com/docs/ts6-manager/latest/video-streaming/)
- [架构](https://www.uniskela.com/docs/ts6-manager/latest/architecture/)
- [环境变量](https://www.uniskela.com/docs/ts6-manager/latest/environment-variables/)


### 在 AI 编码代理中使用本项目

如果你使用 Codex、Cursor、Claude Code 或其他带 [Context7 MCP](https://context7.com/) 的助手，可以让它在修改部署设置或集成之前先查阅 TS6 Manager 的文档。Context7 是可选的；你始终可以直接使用维护中的文档。

> 使用 Context7 MCP 解析 `uniskela/ts6-manager` 的官方文档库（预期 ID：`/uniskela/ts6-manager`），然后获取安装、配置、升级、TeamSpeak 兼容性、音乐/视频机器人和故障排查方面的指导。请将指导内容与我所使用的 TS6 Manager 版本匹配。如果该库仍在索引中或未覆盖该版本，请改为查看[维护中的文档](https://www.uniskela.com/docs/ts6-manager/)及关联的源文件。

## 截图

### 仪表盘
所选服务器的实时概览，按服务器状态、流量和运行状态与容量组织，并显示当前刷新状态。

![仪表盘](docs/public/dashboard.png)

### 频道与客户端
浏览频道树及其中已连接的客户端、静音/暂离状态和密码标记，然后在可排序的客户端列表中搜索并执行单个客户端操作。

![频道树](docs/public/channels.png)

![客户端](docs/public/clients.png)

### 服务器组与权限
管理组成员关系，并使用易读的“简单”标签或原始“技术”名称编辑权限。

![服务器组](docs/public/server-groups.png)

![权限编辑器](docs/public/permissions-editor.png)

### 服务器日志
有界、分页的 `logview` 输出，带级别徽章以及页面内搜索和级别筛选。

![服务器日志](docs/public/server-logs.png)

### 机器人中心
机器人列表，以及在一个地方查看每个机器人当前正在做什么：当前曲目或串流、频道、视频画质、观看人数和最近一次停止原因。每个机器人都可以通过 **打开控制台** 进行播放控制，页面还提供机器人流程、媒体库、串流默认值和 IPTV 的入口。

![机器人中心](docs/public/bot-hub.png)

### 媒体机器人
每台服务器可运行多个媒体机器人。每个机器人都有独立的队列、音量控制和播放状态。支持电台串流、YouTube 和本地音乐库。管理员可以在媒体库 → 电台中从 [Community Radio Browser](https://www.radio-browser.info/) 导入电台。机器人所在频道的用户可以通过文本命令（`!radio`、`!play`、`!vol` 等）控制它。

![媒体机器人](docs/public/musicbots.png)

### 视频串流 / IPTV
浏览已配置的 M3U/M3U8 播放列表 URL 中的频道，并通过运行中的媒体机器人和视频 Sidecar 串流所选频道。

![视频串流与 IPTV](docs/public/iptv.png)

### 机器人流程引擎
用于构建服务器自动化工作流的可视化节点编辑器。可读的正交连线、带标签的条件分支，以及按真实流程尺寸扩展的画布，让较大的自动化流程仍然易于浏览。未保存的草稿在应用内正常导航和查询刷新时受到保护。

![流程编辑器](docs/public/flow-editor.png)

### 流程模板
使用预置流程模板快速开始。涵盖临时频道创建、AFK 移动、空闲踢出、在线人数统计和组保护等常见场景。一键导入，然后按需自定义。

![流程模板](docs/public/flow-templates.png)

### 无需 TeamSpeak 即可试用
Demo TeamSpeak Server 连接提供合成的频道、客户端、组、权限、封禁和日志，让你无需真实服务器即可探索界面。上面的频道、客户端、组、权限编辑器和日志截图均来自它。参见[配置](docs/public/configuration.md#demo-server-for-ui-testing)。

![Demo 连接](docs/public/demo-connection.png)

### 权限比较
在只读表格中比较同一权限层中的两到四个实体。“简单”或“技术”标签，以及“任意一项已设置”/“仅显示差异”筛选，让原始值、未设置状态、Skip 和 Negate 标记更容易审阅。

![权限比较](docs/public/permissions-compare.png)

## 功能

### 服务器管理
- 仪表盘按服务器状态、流量和运行状态与容量的层级展示
- 虚拟服务器列表，支持启动/停止
- 频道树，支持拖拽排序以及触摸/键盘移动
- 客户端列表，支持带确认的、待处理安全的踢出和封禁操作，以及移动和戳一戳
- 服务器组和频道组管理
- 权限编辑器（服务器、频道、客户端、组级别），支持上下文安全的草稿、“简单/技术”标签，以及最多四个实体的只读同层比较
- 封禁列表管理
- 令牌 / 特权密钥管理
- 投诉查看器
- 离线消息系统
- 带筛选的服务器日志查看器
- 频道文件浏览器，支持上传/下载
- 实例级设置

### 媒体机器人
- 每台服务器多个机器人，每个机器人都拥有独立队列和播放状态
- 电台串流，支持 ICY 元数据和实时标题更新
- 通过 yt-dlp 播放 YouTube（搜索、串流/按需播放并在需要时回退到下载、队列和媒体库下载）
- 音乐库管理（上传、整理、播放列表）
- 本地/已下载曲目按媒体速度增量解码，长时间播放时内存占用保持有界
- TeamSpeak 语音主机名每次连接只解析一次，而不是每个 UDP 包解析一次
- 音量控制、暂停、跳过、上一首、随机播放、循环
- 立体声音频，稳定的 20ms 节奏
- 指数退避自动重连，并防止重叠
- 频道内文本命令，免手操作
- 音乐请求历史记录

### 视频串流
- 将 YouTube、Twitch 或直接 URL 的实时视频串流到 TeamSpeak 频道
- 基于 WebRTC，使用 Go Sidecar（Pion）中继，低延迟交付
- 画质预设（480p、720p、1080p）
- M3U/M3U8 播放列表 URL 管理；管理员还可以上传 `.m3u`、`.m3u8` 或 `.txt` 播放列表文件（参见[视频串流](https://www.uniskela.com/docs/ts6-manager/latest/video-streaming/)）；频道浏览、筛选和媒体机器人串流
- 浏览器内 WebRTC 预览播放
- 通过 RTCP Sender Reports 实现音视频同步
- 作为 Docker Sidecar 容器与后端一起运行；每个版本还会发布可选的[原生二进制文件](docs/public/native-sidecar.md)，用于宿主机 GPU 编码器

### 机器人流程引擎
- 可视化流程编辑器，支持拖拽节点、动态画布范围、圆角正交连线和带标签的真/假分支
- 触发器：TS3 事件、cron 计划、Webhook（强制密钥）、聊天命令（全局或频道专属）
- 操作：踢出、封禁、移动、消息、戳一戳、频道创建/编辑/删除、HTTP 请求、WebQuery 命令、媒体机器人控制和实用工具操作
- 条件、持久流程变量、执行局部临时值、延迟和日志
- 动态频道名称（按计时器轮换文本）
- 带筛选器和表达式的占位符系统
- 常见自动化任务的预置模板

### 服务器小组件
- 可嵌入网站和论坛的服务器状态横幅
- 基于令牌的公开访问（无需身份验证）
- 可作为实时页面、SVG 或 PNG 图片使用
- 深色和浅色主题
- 可配置：显示/隐藏频道树和客户端列表

### 安全性
- 初始管理员账户设置向导（无默认凭据）
- 使用 AES-256-GCM 加密存储的凭据（API 密钥、SSH 密码）
- 对所有出站 HTTP 请求和 FFmpeg URL 提供 SSRF 防护
- 身份验证端点限流
- JWT 访问令牌 + 刷新令牌轮换，并检测重用
- 基于角色的访问控制（admin / viewer）
- 面向多租户部署的按服务器访问控制
- 机器人流程中的 WebQuery 命令白名单（阻止破坏性命令）
- 经过身份验证的 WebSocket 连接
- 密码复杂度要求
- 生产 Node 镜像不包含 npm/npx/pnpm/Corepack 和 esbuild 构建工具；CI 会重新构建并对所有发布镜像执行 Trivy 扫描，发现可修复的 HIGH/CRITICAL 问题时失败

### 设置与管理
- 界面语言支持英文或简体中文，访客可在设置 → 外观或公开页面中切换；选择保存在浏览器中
- 浏览器本地外观控制，提供浅色、深色或黑色基础主题，以及青色、紫色、红色、蓝色、翠绿色或琥珀色强调色
- yt-dlp Cookie 文件管理，用于访问年龄限制或会员专属的 YouTube 内容
- 可通过文件上传或在界面中直接粘贴 Cookie
- 仅管理员可用的设置面板

## 架构

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Backend    │────▶│  TS Server      │
│  React SPA   │     │  Express API │     │  WebQuery HTTP  │
│  nginx :80   │     │  Node :3001  │     │  SSH (events)   │
└──────────────┘     └──────┬───────┘     └─────────────────┘
                            │
                     ┌──────┴───────┐
                     │   SQLite     │
                     │   (Prisma)   │
                     └──────────────┘
                            │
                     ┌──────┴───────┐
                     │   Sidecar    │
                     │  Go/Pion     │
                     │  WebRTC :9800│
                     └──────────────┘

Public:  /widget/:token  ──▶  SVG / PNG / JSON (no auth)
```

pnpm monorepo 中的**四个包**：

| 包 | 说明 |
|---------|-------------|
| `@ts6/common` | 共享类型、常量和工具函数 |
| `@ts6/backend` | Express API、WebQuery 客户端、机器人引擎、语音机器人、小组件 |
| `@ts6/frontend` | 基于 Vite、TailwindCSS、shadcn/ui 的 React SPA |
| `sidecar` | 用于视频串流的 Go WebRTC 媒体中继（Pion） |

后端代理所有 TeamSpeak API 调用。前端永远无法直接访问 API 密钥或服务器凭据。

## 技术栈

**前端：** React 18、Vite、TailwindCSS、shadcn/ui、TanStack Query + Table、React Flow、Recharts、Zustand

**后端：** Node.js、Express、Prisma（SQLite）、JWT 身份验证、WebQuery HTTP 客户端、SSH 事件监听器

**语音/音频：** 自定义 TS3 语音协议客户端（UDP）、Opus 编码、FFmpeg、yt-dlp

**视频串流：** Go Sidecar，使用 Pion WebRTC v4，通过 RTCP Sender Reports 实现音视频同步

## 快速开始（Docker）

预构建镜像只针对由 Release Please 创建的不可变 `vX.Y.Z` 发布版本发布。普通推送和合并到 `main` 的 PR **不会**发布镜像。[`.github/workflows/publish-images.yml`](.github/workflows/publish-images.yml) 会在发布创建后调用，也提供手动恢复路径，用于重新发布已有的发布标签。

**GitHub Container Registry（默认）**——本仓库的 compose 文件使用它：

| 服务  | 镜像 |
|----------|--------|
| 后端  | `ghcr.io/uniskela/ts6-manager/backend:latest` |
| 前端 | `ghcr.io/uniskela/ts6-manager/frontend:latest` |
| Sidecar  | `ghcr.io/uniskela/ts6-manager/sidecar:latest` |
| 一体化 | `ghcr.io/uniskela/ts6-manager/all-in-one:latest` |

**Docker Hub（镜像）**——相同的 digest，在 [`uniskela/ts6-manager`](https://hub.docker.com/r/uniskela/ts6-manager) 上使用扁平标签；仅当 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN` 两个仓库密钥都设置时才发布（否则 GHCR 仍会发布，但 Hub 标签可能缺失或过期）。镜像成功发布后，另一个 Hub 令牌（`dockerhub-description` 环境中的 `DOCKERHUB_DESCRIPTION_TOKEN`）会把 GitHub 仓库简介和本 README 的精简副本放到该 Hub 页面，并链接回该版本的完整 README：

| 服务  | 镜像 |
|----------|--------|
| 后端  | `uniskela/ts6-manager:backend` |
| 前端 | `uniskela/ts6-manager:frontend` |
| Sidecar  | `uniskela/ts6-manager:sidecar` |
| 一体化 | `uniskela/ts6-manager:all-in-one` |

启用 Hub 发布后，带版本的 Hub 标签形如 `uniskela/ts6-manager:backend-1.10.1`。除非你明确需要 Docker Hub，否则优先使用 GHCR。

当包设置为 **Public**（Packages → 每个镜像 → Package settings）后，无需登录即可拉取 GHCR。工作流会在首次发布后尝试自动设置。

### 分离式部署（默认）

1. 下载 [`docker-compose.yml`](docker-compose.yml)
2. 在它旁边创建 `.env` 文件：

```env
JWT_SECRET=your-random-secret-at-least-32-characters
ENCRYPTION_KEY=another-random-secret-for-credential-encryption
SIDECAR_SECRET=shared-secret-between-backend-and-sidecar
```

生成安全值：

```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "SIDECAR_SECRET=$(openssl rand -base64 32)" >> .env
```

3. 启动服务栈：

```bash
docker compose up -d
```

4. 打开 `http://localhost:3000/setup` 并创建管理员账户
5. 登录后，在 **设置 → 连接** 中添加 TeamSpeak 服务器连接（主机、WebQuery 端口、API 密钥）

> 生产环境中 **必须** 设置 `JWT_SECRET`、`ENCRYPTION_KEY` 和 `SIDECAR_SECRET`。当 `NODE_ENV=production` 时，后端缺少这些值会拒绝启动。
> Sidecar HTTP API 使用 `SIDECAR_SECRET` 进行身份验证，默认不会发布到宿主机。
> 浏览器 WebRTC 预览需要发布 UDP mux（`WEBRTC_UDP_PORT`，通常是 `10000`）和 `WEBRTC_NAT1TO1_IP`——参见 `docker-compose.pr-test.yml` 和[视频串流](docs/public/video-streaming.md)。

### 连接凭据与升级

WebQuery API 密钥和 SSH 密码在存入持久化 SQLite 数据库之前会被加密。因此，只要数据库卷和加密密钥保留，正常的容器重启和镜像升级**不需要**重新输入连接凭据。

- 只需生成一次 `ENCRYPTION_KEY`，并在重启、升级和重新部署时保持相同值。更改它会导致 TS6 Manager 无法解密使用旧密钥存储的凭据。
- 手动创建 WebQuery API 密钥时，如果需要持久密钥，请包含 `lifetime=0`（例如 `apikeyadd scope=manage lifetime=0 ip=0.0.0.0/0`）。省略 `lifetime` 可能创建有时限的密钥，之后会开始返回 `invalid apikey`。
- 编辑现有连接时，WebQuery API 密钥或 SSH 密码等秘密输入框有意不会回填到浏览器。将其中某个字段留空会保持已保存的加密值不变。
- 启动时，TS6 Manager 会在后台验证恢复的 WebQuery 凭据，不会延迟 WebUI。诸如 `invalid apikey` 的日志消息表示 TeamSpeak 服务器拒绝了已保存的密钥；这并不意味着 TS6 Manager 忘记或清除了它。
- 初始握手期间的临时 SSH 关闭会自动重试。身份验证和主机密钥失败仍是致命错误，需要修正连接设置或服务器信任配置。

### 一体化部署（单容器）

在一个镜像中运行 nginx + 后端 + Sidecar（改编自上游 [PR #64](https://github.com/clusterzx/ts6-manager/pull/64)，作者 [@joaobosconff](https://github.com/joaobosconff)）：

```bash
# 与上面相同的 .env 密钥
docker compose -f docker-compose.all-in-one.yml up -d
# 或：docker pull ghcr.io/uniskela/ts6-manager/all-in-one:latest
```

打开 `http://localhost:3000`（可用 `HOST_PORT` 覆盖）。只发布 80 端口；后端和 Sidecar 留在容器内的回环地址上。

### 从源码构建

**包含 TeamSpeak 6（beta13）的完整本地栈**——首选的顺利路径：

```bash
git clone https://github.com/uniskela/ts6-manager.git
cd ts6-manager
cp .env.pr-test.example .env
docker compose -f docker-compose.pr-test.yml up --build
```

然后打开 `http://localhost:3000/setup`，创建第一个管理员并登录。内置的 TeamSpeak 连接已经存在（WebQuery + SSH Query）。Demo 模式仍可单独使用。

**仅管理器（不含 TeamSpeak）：** 将 `JWT_SECRET`、`ENCRYPTION_KEY` 和 `SIDECAR_SECRET` 写入 `.env` 后，使用 `docker compose -f docker-compose.local.yml up -d --build`。

> 本仓库是原始 [`clusterzx/ts6-manager`](https://github.com/clusterzx/ts6-manager) 项目的一个有明确取舍的延续版本。

### Coolify / 反向代理

以 [`docker-compose.coolify.yml`](docker-compose.coolify.yml) 作为起点。与标准 compose 的主要区别：

- 没有 `ports` 部分——路由由反向代理处理
- 在 Coolify 中为 **前端** 服务设置域名（80 端口）
- 如果你的 TS 服务器运行在单独的 Docker 网络中，请将其作为外部网络添加到后端服务：

```yaml
services:
  backend:
    networks:
      - ts6-network
      - ts-server-net

networks:
  ts-server-net:
    external: true
    name: your-ts-server-network-id
```

## 开发

要求：Node.js 20+ 和 **pnpm 9.x**。CI 有意使用 pnpm 9；更新的 pnpm 主版本会改变依赖构建脚本/override 的处理方式，目前还不是受支持的本地基线。

使用 Corepack 进行可复现的本地设置：

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev          # 并行启动后端 + 前端
```

后端运行在 `:3001`，前端运行在 `:5173`（Vite 开发服务器）。

### 数据库

使用 Prisma 和 SQLite。首次运行（本地开发）：

```bash
cd packages/backend
npx prisma db push
npx prisma db seed
```

**Docker Compose 升级：** 每次后端启动都会运行 [`docker-commands/apply-schema.sh`](docker-commands/apply-schema.sh)。如果持久化的 `backend-data` 卷中已有数据库（包括没有版本标记的旧镜像安装），脚本会记录升级、运行 `prisma db push` 使 schema 保持最新、在需要时执行种子，并将 `packages/backend/prisma/SCHEMA_VERSION` 记录到 `data/.schema-version`。拉取新镜像后执行 `docker compose up` 不需要手动迁移步骤——每当 Prisma schema 变化时请更新 `SCHEMA_VERSION`，以保持升级日志准确。

## 环境变量

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `JWT_SECRET` | - | **必填。** 用于 JWT 签名的密钥。生产环境必须设置。 |
| `ENCRYPTION_KEY` | - | **生产环境必填。** 用于加密存储凭据的专用 AES-256-GCM 密钥。生成一次并在重启/升级时保持相同值；开发环境可回退到 `JWT_SECRET`。 |
| `PORT` | `3001` | 后端端口 |
| `DATABASE_URL` | `file:./data/ts6webui.db` | SQLite 数据库路径 |
| `JWT_ACCESS_EXPIRY` | `15m` | 访问令牌有效期 |
| `JWT_REFRESH_EXPIRY` | `7d` | 刷新令牌有效期 |
| `FRONTEND_URL` | `http://localhost:3000` | CORS 来源 |
| `PUBLIC_URL` | - | 可选。TeamSpeak 客户端访问管理器所用的地址；托管的频道横幅链接以它开头。也可以在频道横幅选择器中设置。 |
| `MUSIC_DIR` | `/data/music` | 下载音乐文件的目录 |
| `SIDECAR_URL` | - | 可选。WebRTC Sidecar 服务的完整 URL（例如 `http://ts6-sidecar:9800`）。当 Sidecar 作为单独容器运行时在 Docker 中设置。 |
| `SIDECAR_SECRET` | - | **生产环境中设置 `SIDECAR_URL` 时必填。** 用于 Sidecar 变更 API 的共享 Bearer 令牌。 |
| `YT_COOKIE_FILE` | - | 可选。yt-dlp 使用的 Netscape 格式 cookies.txt 文件路径。也可以通过界面中的 **设置 → YouTube** 管理。 |

## 环境变量：Sidecar / 视频串流

以下默认值是 **Sidecar 代码默认值**。Compose 文件可能有意覆盖它们（例如，标准分离式 compose 会提高 RTP 队列大小）。

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `WEBRTC_UDP_PORT` | 未设置 | 用于浏览器 WebRTC 预览的共享 IPv4 ICE UDP mux 端口（在 Docker 中发布此 UDP 端口） |
| `WEBRTC_NAT1TO1_IP` | 未设置 | 作为 ICE 主机候选广播的宿主机/局域网/Tailscale **IPv4** 地址 |
| `WEBRTC_BIND_IP` | `127.0.0.1`（compose） | 已发布 WebRTC UDP 映射的宿主机绑定地址 |
| `VIDEO_QUEUE_SIZE` | `4096` | 视频 RTP 队列大小（数据包） |
| `AUDIO_QUEUE_SIZE` | `2048` | 音频 RTP 队列大小 |
| `SYNC_PLAYOUT_BUFFER_MS` | `50` | 在较晚音轨的延迟之上为两条音轨添加的播放缓冲 |
| `SYNC_VIDEO_BIAS_MS` | `0` | 可选的额外视频延后，用于微调同步 |
| `SYNC_MAX_DELAY_MS` | `1000` | 为匹配另一条音轨而最多延后一条音轨的时间，以及第一条音轨等待另一条音轨启动的最长时间 |
| `AUDIO_DELAY_MS` | `0` | 可选的手动音频延迟；使用自适应节奏时通常保持 `0` |
| `SIDECAR_DEBUG_LOGS` | `0` | 设为 `1` 以启用详细的高频运行时日志 |
| `SIDECAR_HOST` | 未设置 | Sidecar HTTP API 监听的地址。未设置时监听所有接口（Docker）。使用[原生 Sidecar](docs/public/native-sidecar.md) 时请设置。 |
| `VIDEO_RTP_READ_BUFFER` | `4194304` | 请求的视频 RTP UDP 套接字读取缓冲区 |
| `AUDIO_RTP_READ_BUFFER` | `1048576` | 请求的音频 RTP UDP 套接字读取缓冲区 |
| `VIDEO_WIDTH` | `1280` | API 未提供时的默认输出宽度 |
| `VIDEO_HEIGHT` | `720` | API 未提供时的默认输出高度 |
| `VIDEO_FRAMERATE` | `30` | API 未提供时的默认输出帧率 |
| `VIDEO_BITRATE` | `1500k` | 默认 VP8 目标比特率 |
| `AUDIO_BITRATE` | `128k` | 默认 Opus 目标比特率 |
| `VIDEO_CPU_USED` | `4` | libvpx 实时速度/质量权衡 |
| `VIDEO_ENCODE_THREADS` | CPU 数量 | libvpx 编码线程数 |
| `VIDEO_BUFSIZE` | 自动 | 可选覆盖；否则约为 `2 × VIDEO_BITRATE` |
| `FFMPEG_HTTP_PERSISTENT` | `auto` | `auto` 和 `0` 会在远程 HTTP(S) 请求中发送 `Connection: close`，包括不透明/重定向的 HLS 播放列表和分片。对 MPEG-TS 和 MP4 同样安全。`1` 保持 FFmpeg 的连接行为不变。适用于播放和探测；仅 Sidecar。 |
| `FFMPEG_EXTRA_INPUT_ARGS` | 未设置 | 每个远程输入之前的额外选项，也用于探测。自定义请求头会保留；`Connection` 由 `FFMPEG_HTTP_PERSISTENT` 管理。HLS 专属选项（如 `-http_persistent`）可能破坏 MP4/MPEG-TS。包含 `-i` 或裸 URL 的值会被忽略。 |
| `FFMPEG_EXTRA_OUTPUT_ARGS` | 未设置 | 插入到每个 RTP 输出之前的额外 FFmpeg 选项。 |

## 媒体机器人文本命令

当媒体机器人连接到已配置的命令频道后，该频道中的用户可以通过聊天控制它。以下是内置命令；自定义命令（以及推荐的预设，如 `!rules` / `!links`）也可以在“媒体机器人 → 命令”中配置。

- **`!help`** - 显示内置命令和自定义命令
- **`!here [id]`** / **`!come [id]`** - 将一个空闲的媒体机器人召唤到你的频道（或按 ID 指定机器人）
- **`!commands`** - 列出已启用的自定义聊天命令
- **`!play <url>`** - 播放 YouTube、Spotify 或 Apple Music 媒体
- **`!play`** - 继续暂停的播放
- **`!history`** - 显示此机器人最近 10 次请求
- **`!again [id]`** - 按 ID 重放已存储的请求，或重放最近一次
- **`!queue [show|clear|remove <n>|play <n>|<url>]`** - 使用从 1 开始的位置显示或管理队列
- **`!add <url>`** - `!queue <url>` 的别名
- **`!playlist [name-or-id]` / `!pl <name-or-id>`** - 列出或追加已保存的播放列表；空闲且已连接的机器人会按队列顺序继续播放
- **`!repeat [off|track|queue]`** - 显示或设置循环模式
- **`!seek <seconds|+seconds|-seconds>`** - 在本地/已下载曲目中跳转
- **`!remove <text>`** - 移除一个无歧义的待播放标题/艺术家匹配项
- **`!shuffle [on|off]`** - 切换或设置随机播放
- **`!stop`** - 停止播放
- **`!pause`** - 切换暂停/继续
- **`!skip` / `!next`** - 队列中的下一首
- **`!voteskip`** - 投票跳过当前曲目；机器人频道中超过半数的人类听众必须投票
- **`!remote [bot name]`** - 获取一个私密的一次性手机听众遥控链接
- **`!prev`** - 上一首
- **`!vol [0-100]` / `!volume [0-100]`** - 显示或设置音乐、电台、视频和 IPTV 的音量
- **`!np` / `!nowplaying`** - 显示当前曲目
- **`!radio [id]`** - 列出或播放电台
- **`!stream <url> [preset]`** - 启动视频串流（YouTube 和 Twitch 链接默认使用自动画质；也可用 `auto`、`480p` … `2160p`）
- **`!stopstream`** - 停止当前视频串流
- **`!viewers`** - 列出串流观看者
- **`!channels [search]`** - 列出/搜索 IPTV 频道
- **`!tv <name>` / `!iptv <name>`** - 串流一个 IPTV 频道
- **`!lyrics [artist - title]`** - 显示当前曲目的歌词或搜索歌词

## 要求

- 启用了 **WebQuery HTTP** 的 TeamSpeak 服务器（不是原始/telnet）
- WebQuery API 密钥（通过 `apikeyadd` 或服务器管理工具生成）
- 使用文件浏览器、机器人流程事件触发器或媒体机器人频道聊天命令时，需要 TS 服务器的 SSH ServerQuery 访问权限
- 后端已安装 `yt-dlp` 和 `ffmpeg`（Docker 镜像中已包含）

## TeamSpeak 兼容性与 beta13 设置

测试过的 TeamSpeak Server：**6.0.0-beta13**（官方镜像
`teamspeaksystems/teamspeak6-server:6.0.0-beta13`）。并未有意排除旧版本；下面的手动密钥方法仍然可用。

请在 **TeamSpeak 服务器/容器** 上配置以下内容，而不是 TS6 Manager 容器：

```env
TSSERVER_QUERY_HTTP_ENABLED=1
TSSERVER_QUERY_HTTP_ALLOW_GUEST=0
TSSERVER_QUERY_SSH_ALLOW_GUEST=0
TSSERVER_QUERY_ADMIN_API_KEY=<secure-stable-key>
```

Beta13 默认启用访客 HTTP/SSH Query 访问。对于管理型部署，
我们建议显式禁用：TS6 Manager 需要经过身份验证的 WebQuery，
并使用可选的经过身份验证的 SSH。只有当你确实希望暴露 Guest Server Query 权限时，
才可以保持访客访问启用；本应用不需要它。请将 Query 端口限制在受信任的管理网络内。

在 beta13+ Docker 中，`TSSERVER_QUERY_ADMIN_API_KEY` 是预置内置 `serveradmin`
管理密钥最简单、最确定的方式。生成一个强密钥并保持稳定。**更改它会替换相关的内置 serveradmin 管理
API 密钥。** TS6 Manager 中先前加密的密钥随后将无法通过身份验证；
请更新已保存连接中的 API 密钥。不要记录或共享该值。TS6
Manager 会继续加密存储连接秘密；密钥仍然是必需的。

或者，包括在旧服务器上，使用经过身份验证的 SSH Query 连接：

```text
use 1
apikeyadd scope=manage lifetime=0 ip=0.0.0.0/0
```

`lifetime=0` 使密钥永不过期。在实际可行的情况下缩小允许的源 IP 范围。引导方法和手动方法是替代方案，不是两个必需步骤。

Beta13 还提供**可选的外部 Prometheus 监控**。指标默认禁用
（`TSSERVER_METRICS_ENABLED=0`）；默认端口为 `9187`。该端点是
未认证的。请将其绑定到受限接口（`TSSERVER_METRICS_IP`）并
应用防火墙/网络限制，而不是公开暴露。逐包
语音诊断（`TSSERVER_METRICS_VOICE`）会增加开销：在繁忙的生产服务器上启用前请先基准测试。
当连接启用**指标抓取**时，TS6 Manager 会从配置的主机/端口（默认使用 WebQuery 主机）
获取 `/metrics` 以增强仪表盘；请保持该监听器私有，并可从后端访问
（当管理器在远程时，不要只绑定 localhost）。

Beta13 中服务器日志默认使用 UTC。管理员可以使用 `TSSERVER_LOG_TIMEZONE` 选择 `utc` 或 `local`。
TS6 Manager 显示原始日志文本，不转换其时间戳。

单独的[兼容性工作流](.github/workflows/ts6-compat.yml)会在手动、每周以及修改冒烟测试或 WebQuery 客户端的 PR 时运行，并提供镜像标签输入以支持未来的 beta 版本。它会启动一个隔离的官方
服务器，使用临时管理员密钥并禁用访客 Query，等待虚拟服务器上线，
拒绝未认证的 HTTP 访问，并实际调用
`WebQueryClient`：`version`、`serverinfo`、`clientlist`、`channellist` 和
`serverrequestconnectioninfo`，以及频道创建/查询/非强制删除的往返流程。
它不认证语音/视频播放、公开 YouTube 可用性、SSH/文件
传输、生产网络或所有服务器配置。它与快速 PR 验证相互独立。

## 下载进度

显式的媒体库下载（单首、选中批量以及播放列表的“下载所选”）
会显示当前/总项目数、真实的 yt-dlp 百分比、速度、ETA 和处理状态。
任务在后台运行；完成/失败或组件卸载后停止轮询。
进度端点要求应用身份验证、管理员权限，并匹配
服务器和请求用户。任务保存在内存中，最多保留 100 个 / 同时运行 4 个，
十分钟无更新或总计三十分钟后过期。后端
重启会丢失进度历史。串流播放列表注册保留其现有
语义，不会立即下载媒体。

### 内置 yt-dlp 生命周期

生产容器不会自行更新软件包。yt-dlp 在镜像
构建时使用 pip 必需的 PEP-668 选项安装；构建会检查 `yt-dlp --version`、
`ffmpeg -version`、`node --version` 和 `deno --version`。固定版本的 Deno 二进制文件
（见 `.deno-version`）是 yt-dlp 用于 YouTube EJS / `n`
挑战的 JavaScript 运行时（仅 `--js-runtimes deno`）。镜像中的 Node 保持为 20，以用于 Nest
后端，并且未配置为 EJS 回退（yt-dlp 需要 Node 22+）。
拉取新构建的 TS6 Manager 镜像并重新创建容器即可刷新
内置的 yt-dlp 和 Deno。使用全新的镜像构建重新构建也会刷新它们。
不提供应用内软件包更新器。提取器测试使用结构化 fixture；公开视频
冒烟测试有意不作为发布门禁，因为可用性、速率限制
和地区限制不在我们的控制范围内。

## 贡献者

TS6 Manager 由 [@uniskela](https://github.com/uniskela) 维护，并建立在 [@clusterzx](https://github.com/clusterzx) 的 [clusterzx/ts6-manager](https://github.com/clusterzx/ts6-manager) 之上。

感谢以下人员（[emoji 图例](https://allcontributors.org/en/reference/emoji-key/)）：

<!--
  Contributor avatar table: All Contributors emoji types
  (https://allcontributors.org/en/reference/emoji-key/).
  Layout approach inspired by Soju06/codex-lb README
  (https://github.com/Soju06/codex-lb) - not a copy of that list.
  Detailed provenance stays in CREDITS.md.
-->
<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/uniskela"><img src="https://avatars.githubusercontent.com/u/104075208?v=4&s=100" width="100px;" alt="Uniskela"/><br /><sub><b>Uniskela</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=uniskela" title="Code">💻</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=uniskela" title="Documentation">📖</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=uniskela" title="Maintenance">🚧</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=uniskela" title="Infrastructure">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/clusterzx"><img src="https://avatars.githubusercontent.com/u/32274973?v=4&s=100" width="100px;" alt="clusterzx"/><br /><sub><b>clusterzx</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=clusterzx" title="Code">💻</a> <a href="#ideas-clusterzx" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Albirew"><img src="https://avatars.githubusercontent.com/u/2805161?v=4&s=100" width="100px;" alt="Albirew"/><br /><sub><b>Albirew</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3AAlbirew" title="Bug reports">🐛</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=Albirew" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/BalconyJH"><img src="https://avatars.githubusercontent.com/u/73932916?v=4&s=100" width="100px;" alt="BalconyJH"/><br /><sub><b>BalconyJH</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3ABalconyJH" title="Bug reports">🐛</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=BalconyJH" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/BehaveDude"><img src="https://avatars.githubusercontent.com/u/255583987?v=4&s=100" width="100px;" alt="BehaveDude"/><br /><sub><b>BehaveDude</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3ABehaveDude" title="Bug reports">🐛</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=BehaveDude" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bro-network"><img src="https://avatars.githubusercontent.com/u/174516032?v=4&s=100" width="100px;" alt="bro-network"/><br /><sub><b>bro-network</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=bro-network" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bufanda"><img src="https://avatars.githubusercontent.com/u/30717829?v=4&s=100" width="100px;" alt="bufanda"/><br /><sub><b>bufanda</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3Abufanda" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/coom"><img src="https://avatars.githubusercontent.com/u/10179617?v=4&s=100" width="100px;" alt="coom"/><br /><sub><b>coom</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=coom" title="Code">💻</a> <a href="#ideas-coom" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/crtnbr"><img src="https://avatars.githubusercontent.com/u/45666738?v=4&s=100" width="100px;" alt="crtnbr"/><br /><sub><b>crtnbr</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3Acrtnbr" title="Bug reports">🐛</a> <a href="#ideas-crtnbr" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/D3nnis3n"><img src="https://avatars.githubusercontent.com/u/25908592?v=4&s=100" width="100px;" alt="Dennis Scholz"/><br /><sub><b>Dennis Scholz</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3AD3nnis3n" title="Bug reports">🐛</a> <a href="#ideas-D3nnis3n" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=D3nnis3n" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dbillai"><img src="https://avatars.githubusercontent.com/u/158840331?v=4&s=100" width="100px;" alt="dbillai"/><br /><sub><b>dbillai</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3Adbillai" title="Bug reports">🐛</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=dbillai" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/DomeNinchen"><img src="https://avatars.githubusercontent.com/u/217283391?v=4&s=100" width="100px;" alt="DomeNinchen"/><br /><sub><b>DomeNinchen</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=DomeNinchen" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/GingerFury6"><img src="https://avatars.githubusercontent.com/u/168943721?v=4&s=100" width="100px;" alt="Philipp"/><br /><sub><b>Philipp</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=GingerFury6" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/joaobosconff"><img src="https://avatars.githubusercontent.com/u/31070155?v=4&s=100" width="100px;" alt="João Bosco"/><br /><sub><b>João Bosco</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=joaobosconff" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/KorppuJauho"><img src="https://avatars.githubusercontent.com/u/130571566?v=4&s=100" width="100px;" alt="KorppuJauho"/><br /><sub><b>KorppuJauho</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=KorppuJauho" title="Code">💻</a> <a href="https://github.com/uniskela/ts6-manager/issues?q=author%3AKorppuJauho" title="Bug reports">🐛</a> <a href="#ideas-KorppuJauho" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kytos22"><img src="https://avatars.githubusercontent.com/u/13838233?v=4&s=100" width="100px;" alt="Marcos Vidal Martinez"/><br /><sub><b>Marcos Vidal Martinez</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=kytos22" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/LemDog"><img src="https://avatars.githubusercontent.com/u/19418647?v=4&s=100" width="100px;" alt="Maxwell D."/><br /><sub><b>Maxwell D.</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=LemDog" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/LennBoedd"><img src="https://avatars.githubusercontent.com/u/87300236?v=4&s=100" width="100px;" alt="Lennart B."/><br /><sub><b>Lennart B.</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3ALennBoedd" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/LgnRorooo"><img src="https://avatars.githubusercontent.com/u/115776545?v=4&s=100" width="100px;" alt="Rodrigo De Almeida Pina"/><br /><sub><b>Rodrigo De Almeida Pina</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=LgnRorooo" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/liqinghan2000"><img src="https://avatars.githubusercontent.com/u/104827187?v=4&s=100" width="100px;" alt="liqinghan2000"/><br /><sub><b>liqinghan2000</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3Aliqinghan2000" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Lordeisenhelm"><img src="https://avatars.githubusercontent.com/u/134092155?v=4&s=100" width="100px;" alt="Lord"/><br /><sub><b>Lord</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3ALordeisenhelm" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/meauxh"><img src="https://avatars.githubusercontent.com/u/127511054?v=4&s=100" width="100px;" alt="meauxh"/><br /><sub><b>meauxh</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3Ameauxh" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mqh9007"><img src="https://avatars.githubusercontent.com/u/45141834?v=4&s=100" width="100px;" alt="mqh9007"/><br /><sub><b>mqh9007</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=mqh9007" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/pimushkin"><img src="https://avatars.githubusercontent.com/u/30329479?v=4&s=100" width="100px;" alt="pimushkin"/><br /><sub><b>pimushkin</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3Apimushkin" title="Bug reports">🐛</a> <a href="#ideas-pimushkin" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/prankroker"><img src="https://avatars.githubusercontent.com/u/76559527?v=4&s=100" width="100px;" alt="Danylo"/><br /><sub><b>Danylo</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=prankroker" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/s3bul"><img src="https://avatars.githubusercontent.com/u/6891296?v=4&s=100" width="100px;" alt="Sebastian K"/><br /><sub><b>Sebastian K</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3As3bul" title="Bug reports">🐛</a> <a href="https://github.com/uniskela/ts6-manager/commits?author=s3bul" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/simardwtf"><img src="https://avatars.githubusercontent.com/u/67881020?v=4&s=100" width="100px;" alt="Julien Simard"/><br /><sub><b>Julien Simard</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=simardwtf" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Slipi089"><img src="https://avatars.githubusercontent.com/u/59597268?v=4&s=100" width="100px;" alt="Martin"/><br /><sub><b>Martin</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3ASlipi089" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/StEnDi78"><img src="https://avatars.githubusercontent.com/u/202441998?v=4&s=100" width="100px;" alt="StEnDi78"/><br /><sub><b>StEnDi78</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3AStEnDi78" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TheMaxik"><img src="https://avatars.githubusercontent.com/u/9915167?v=4&s=100" width="100px;" alt="TheMaxik"/><br /><sub><b>TheMaxik</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3ATheMaxik" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/UIP88"><img src="https://avatars.githubusercontent.com/u/127998909?v=4&s=100" width="100px;" alt="UIP88"/><br /><sub><b>UIP88</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3AUIP88" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/uniplayer1"><img src="https://avatars.githubusercontent.com/u/83558178?v=4&s=100" width="100px;" alt="uniplayer1"/><br /><sub><b>uniplayer1</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=uniplayer1" title="Code">💻</a> <a href="#ideas-uniplayer1" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ValiOff8"><img src="https://avatars.githubusercontent.com/u/241494336?v=4&s=100" width="100px;" alt="Vali"/><br /><sub><b>Vali</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/commits?author=ValiOff8" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/vinookie"><img src="https://avatars.githubusercontent.com/u/110264086?v=4&s=100" width="100px;" alt="vinookie"/><br /><sub><b>vinookie</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3Avinookie" title="Bug reports">🐛</a> <a href="#ideas-vinookie" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Vman1194"><img src="https://avatars.githubusercontent.com/u/270235106?v=4&s=100" width="100px;" alt="Vman1194"/><br /><sub><b>Vman1194</b></sub></a><br /><a href="https://github.com/uniskela/ts6-manager/issues?q=author%3AVman1194" title="Bug reports">🐛</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

本项目遵循 [all-contributors](https://github.com/all-contributors/all-contributors) 规范。欢迎任何形式的贡献。

[CREDITS.md](CREDITS.md) 记录了每个人的贡献，并附有相关 issue、pull request 和 fork 的链接。


## 许可证

MIT
