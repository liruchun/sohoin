# sohoin · 轻社交系统

sohoin（sohoin.com），面向做独立站的朋友的轻社交系统。产品定位见 `PRODUCT.md`，界面与开发要求见 `DESIGN.md`、`docs/SEO-GEO.md` 和 `AGENTS.md`。

传统全栈 Next.js App Router + TypeScript；应用、服务端渲染和后续服务端业务共用一个 Next.js 部署，不另建前后端服务。已有后台及内容、评论、媒体、互动、用户资料与系统通知的数据库/服务基础；前台仍在规划和搭建，具体交付状态以各功能文档为准。

## 开始

使用 Node.js 24 LTS 和 pnpm 11。在项目根目录运行：

```powershell
pnpm install --frozen-lockfile
# 首次：按 docs/ADMIN-SETTINGS.md 配置 .env.local，并执行 pnpm db:local、pnpm db:migrate
pnpm dev
```

日常开发直接运行 `pnpm dev`：它会先检查 `DATABASE_URL`，指向本机回环地址且数据库未运行时，自动从 `.local/postgres17` 启动 PostgreSQL，就绪后再启动 Next.js；已经运行的数据库不会被接管，开发服务退出时只停止本次启动的数据库。数据库指向远程地址时跳过本地启动。首次使用或数据库为空时，仍需先启动数据库并执行迁移。

默认开发与生产启动脚本使用 http://127.0.0.1:3194，与本地认证 Origin 保持一致。

开发脚本使用 Next.js 自带的 Webpack（`next dev --webpack`），作为当前 Turbopack 开发模式下 CSS 独立文件被预加载、实际却使用合并文件时的兼容处理。修改启动命令后需手动重启开发服务；此调整尚未完成重启后的告警验证，开发编译可能变慢。生产构建命令保持原配置。

打开 http://127.0.0.1:3194。验证：`pnpm typecheck`、`pnpm build`。生产启动：`pnpm start`。
依赖使用精确版本并提交 pnpm-lock.yaml；TypeScript 暂采用 5.9.3，后续独立评估主版本升级。

## 目录

```text
apps/web/                   Next.js 宿主，路由、布局、全局样式及注册入口装配
  app/                      App Router（未来服务端操作和 Route Handler 按需添加）
  public/                   静态资源占位
packages/
  core/                     宿主默认实现、未来社区业务模块
  ui/                       默认基础组件和页面容器
  extension-api/            稳定公开类型与扩展契约
  database/                 PostgreSQL 数据层、参数化查询、迁移及共享限流
    migrations/             迁移目录占位
custom/                     项目自有区，宿主升级不得覆盖
  extensions/               扩展声明占位
  components/               替换宿主公开组件
  templates/                替换宿主公开模板
  styles/                   本地样式，加载在宿主样式之后
  register.ts               唯一 Custom 装配入口
```

## 扩展与升级

项目支持 Graphify 本地代码关系索引：首次生成或代码变更后执行 `pnpm graphify:index`，随后使用 `pnpm graphify:query "settingsService"` 查询。使用方法、工具前提和索引范围见 [Graphify 项目索引](docs/GRAPHIFY.md)。索引不参与应用构建与部署。

前台当前使用 Core 默认实现，首页为 `/`，帖子、文章和用户分别为 `/t/[id]`、`/p/[id]`、`/u/[id]`。公开链接使用稳定的 10 位随机公开 ID。旧 `/content` 和 Custom 捕获路由已经移除，Custom 源码与契约保留但暂不装配。

首页为服务端渲染的纯文本信息流，支持精选、最新和文章分页；顶部提供菜单和空白信息弹窗。详情页当前只提供基础文本与公开资料。路由、密钥、索引与验证说明见 `docs/PUBLIC-SITE.md`。

升级仍须保留 `custom/**`，遵守 `docs/UPGRADING.md` 的路径受控合并流程。

## 管理后台

已接入 PostgreSQL 与自托管 Better Auth。后台 /admin 可管理名称、简介、导航及 Custom Header 说明；保存后 Core 与 Custom 共用同一份设置。详细启动、认证、API 与安全验证见 docs/ADMIN-SETTINGS.md。

后台通用组件位于 packages/admin-ui，与前台 packages/ui 独立。已接入 shadcn 组件基础、桌面/手机导航、只读操作记录和当前账号页面。

## 2026-10-20 项目改名为 sohoin（收获里）

当前副本位于 `D:\project\sohoin`，根包名与工作区包名统一为 `sohoin` / `@sohoin/*`，源码、文档、默认站名和本地配置中的旧品牌名已替换为 `sohoin`（中文名“收获里”）；`D:\project\sohodoor` 旧副本保留作备份，未删除。默认域名文案改为 `https://sohoin.com`，仅为目标地址，不代表已注册、解析或上线。

本次复制跳过 `node_modules`、`.git`、`apps/web/.next`、`graphify-out`、`dist`、`coverage` 与 TypeScript/Python 缓存；`.local` 中的数据库、媒体、备份与工具，`output/` 品牌图及 `work/` 材料已保留，`output/brand-icons` 下的文件名已按新名称重命名。依赖未复制，需在新目录自行执行 `pnpm install`；`pnpm-lock.yaml` 中的工作区包名已同步。Git 历史未复制，仓库尚未重新初始化，也没有新的远程地址。

`.env.local` 中的媒体、备份与工具绝对路径已改为新目录；数据库连接、认证密钥、认证 Origin、数据库名与管理员账号保留原值（`aiyanfu`）。数据库已完整复制到 `.local/postgres17`：复制前先停止运行中的开发服务和旧库，复制后从新目录启动，核对 38 张表全部存在且行数一致（内容 20、评论 149、用户 52、媒体 105），验证后已停止。安装依赖后直接运行 `pnpm dev`，未运行的本地数据库会自动从新目录启动；也可用 `pnpm db:local` 单独启动。

库内站点名称已改为 `sohoin`（revision 36→37，写入设置审计）；媒体资产 89 的原始文件名由 `sohodoor.svg` 改为 `sohoin.svg`。历史审计记录与已执行迁移保持原样。公开链接的加密 AAD 仍保留原 `sohodoor` 前缀，使已发出的 10 位 Base36 公开 ID 在改名后继续可解码；`PUBLIC_ID_SECRET` 未改变。

本次未安装依赖、未启动应用服务，未运行构建、类型检查与测试；安装后请自行执行 `pnpm typecheck`、`pnpm build` 和 `pnpm test:security`（会创建专用本地测试数据库）。后台资源隔离可按 `scripts/measure-pages.mjs` 的现有说明检查。
