<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 宿主目录归属

- `app` 保留路由、布局、HTTP 适配与页面组合；业务规则、权限和数据库操作继续由现有 Core 服务承担。目录分组不改变公开 URL，不接入 Custom。
- 页面或同一组子路由专用组件放在该路由的 `_components`；跨路由共享的功能组合放在所属前台/后台区域的 `_features/<功能名>`；区域共享展示组件放在 `_components/<职责>`，不继续平铺到总目录。
- 前台 `(site)/_components/shell` 管理顶栏、品牌、导航和页面外壳；`feedback` 管理站点 Splash、通用两条占位骨架与路由过渡；`content` 管理信息流、详情、用户页复用的内容信息及面板。`_features/feed` 管理信息流、帖子卡片和分页；`_features/content` 管理帖子/文章共用的详情页面组合及 metadata。用户资料面板就近放在 `u/[id]/_components`。公共布局统一提供 SiteMain 和 SiteTransition，页面不再嵌套 main 或另建 Splash/骨架边界。
- 后台 `admin/_components/shell` 管理外壳、导航和品牌；`shared` 仅放确实跨功能复用的展示/操作组件；共享 Hook 放在 `admin/_hooks`。`admin/_features/settings` 管理设置表单、Logo 和图标设置；`profiles` 管理账号页与用户管理共用的资料编辑。
- 后台内容、账号、用户、媒体、分类、通知及评论专用组件放在 `(console)/<功能>/_components`。例如分类选择器目前只被内容编辑器使用，因此归属内容编辑；出现真实跨功能复用需求时再上移。
- 通用基础组件继续放在 `packages/ui`，后台专用基础能力继续放在 `packages/admin-ui`；前台禁止导入后台目录和后台 UI 包。站点专属呈现不因整理目录而挪入公共 UI 包。
- 组件和同名 CSS Module 一起迁移，更新模块引用与 CSS `@reference`。同功能内部优先相对引用，不为每个组件创建目录或统一添加 `index.ts` 转发。保留服务端/客户端边界与常用交互的静态导入。
- `lib` 保留宿主服务装配、服务端适配与公共辅助；不在 `_components` 中新增数据库访问或业务权限实现。

目录迁移后的类型检查、构建、测试、性能测量和浏览器验收仍遵守根目录 AGENTS.md 的用户执行/明确授权规则。
