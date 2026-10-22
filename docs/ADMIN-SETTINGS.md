# 管理后台与共用接口

## 当前能力

管理员登录、退出；修改站点名称、简介、普通/暗黑模式 Logo、导航（增删、排序、隐藏）和当前 Custom Header 说明。保存后数据库立即生效，刷新前台即可看到。设置页仅提交与载入值不同的字段，空字符串和空导航数组视为明确设置。

运行时站名统一读取 `siteName`：前台顶栏、页脚、首页 H1 与 WebSite JSON-LD、帖子/文章/用户页 metadata、404 返回链接，以及后台登录品牌、侧栏与页脚均跟随设置。后台字母/汉字标识从设置名称取首个 Unicode 码点，通用 AdminShell 通过 footer 插槽接收名称；客户端组件不直接读取数据库。复用已有服务端请求内缓存，默认配置中保留“sohoin”，不修改域名、认证或加密标识。此次展示修正未运行构建、测试或浏览器检查。

## Logo 设置

在后台 `/admin` 的“Logo 设置”卡片中分别上传或从媒体库选择两张图片，可移除并撤销修改。普通和暗黑 Logo 均支持 SVG（不超过 1 MiB）、JPEG、PNG、WebP（不超过 10 MiB），推荐透明背景；沿用媒体上传的真实格式校验、重编码、像素限制及元数据清理。上传成功后仍需点击“保存设置”才会发布；取消设置不会自动删除已上传的媒体。

Logo 上传使用 `POST /api/v1/admin/media?purpose=logo`，SVG 以 `image/svg+xml` 发送。服务端仅接受 UTF-8 独立静态图形，拒绝实体、脚本、事件属性、动画及外部资源；允许文档内部的渐变、蒙版等片段引用。使用服务端 @xmldom/xmldom 解析并按允许列表校验元素、属性和受限 CSS，序列化为独立 SVG 保存；公开 Logo 直接以 image/svg+xml 返回，不转 WebP 展示。sharp 只为媒体库另生成 WebP 缩略图。普通媒体上传仍不接受 SVG。已有 WebP 无法还原矢量，需要重新上传 SVG。

SVG 支持的本次变更尚未运行构建或测试；由用户执行 `pnpm typecheck`、`pnpm build`、`pnpm test:security`，并检查两种背景的上传、保存及前台展示。下述历史验证记录不覆盖本次 SVG 改动。

普通 Logo 用于浅色背景，暗黑 Logo 留空时沿用普通版；普通版留空时保留站点文字标识。预览区分别使用浅色和深色背景。当前公开站点仍固定浅色；Header 已支持在根节点、body 或 `.public-site` 设置 `data-theme="dark"` / `dark` 类时选择暗黑 Logo，本任务不增加整站暗黑主题或切换按钮，也不按操作系统偏好把白色 Logo 放到浅色页面上。Logo 按既有品牌区域比例显示；存在可用 Logo 时隐藏站名文字，图片失败时回退文字标识。

设置内部保存 `logo: {normal: 媒体编号或 null, dark: 媒体编号或 null}`，保留 revision 冲突检查和同事务审计；旧数据库未保存 Logo 时自动使用空值，不需要新增迁移。选中媒体在事务内验证并加共享行锁，媒体删除持排他锁后再次检查站点 Logo 引用，防止并发保存与删除产生悬空引用。正在使用的 Logo 不能从媒体库删除；先移除/替换设置并保存。

公开设置只返回 Logo 的公共地址，隐藏媒体编号。`GET /api/v1/site-logo/normal`、`GET /api/v1/site-logo/dark` 只允许读取当前选中的 SVG 或栅格图片缩略图，暗黑版未设置时回退普通版；任意媒体编号和其他变体返回 404。替换或移除立即影响这两个固定地址，响应使用 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff` 与 `X-Robots-Tag: noindex`。原媒体文件接口仍需管理员权限。

Logo 是现有品牌导航的装饰图片，链接的可访问名称及可见站点文字保留；尺寸预留，不新增 H1 或内容落地页。图片接口不进入 sitemap，不创建虚构的 Organization 实体，也不向现有 WebSite JSON-LD 添加不适用的 logo 属性。原有页面 canonical、robots、结构化数据和 sitemap 策略保持适用。

本地验证（2026-10-15）：`pnpm typecheck`、`pnpm build` 通过；`pnpm test:security` 共 70 项通过，包含 Logo 发布/替换/移除、暗黑回退、越权、无效/已删除媒体、版本冲突、同事务审计及并发删除保护。后台按官网默认组件风格统一后，已完成设置页 1440px 与 390px 的截图及 DOM 检查，无横向溢出。Alert Dialog 取消不提交写入，焦点返回触发按钮；取消未保存离开时保留输入。

使用 `scripts/measure-pages.mjs` 对比同一数据下的本地生产构建（默认未配置 Logo）：首页 HTML 增加 41 B、JS gzip 增加 281 B、CSS 增加 69 B；后台设置页 HTML 增加 2,111 B、JS gzip 增加 1,460 B、CSS 增加 841 B。两页 JS/CSS 请求数均不变，公开 client-reference manifest 中没有 admin-ui 或 Radix 组件。原始结果在忽略目录 `.local/performance/logo-before.json` 与 `logo-after.json`；这是本地构建体积比较，不是线上速度或搜索引擎验收。测量脚本允许对独立预览端口发请求，同时继续使用既有受信任认证 Origin，不修改认证配置。

优先级：数据库已保存字段 → Custom settingsDefaults → Core 默认值。Core 默认版与 Custom 版读取同一份已解析设置。Header 说明属于公开展示字段，只在定制 Header 中使用；此设置表不存认证密钥。

## 本地使用

已生成 apps/web/.env.local（被 Git 忽略），包含本地数据库密码、认证密钥和初始管理员信息。不要提交该文件。

日常开发只需一个终端，在项目根目录执行：

~~~powershell
pnpm dev
~~~

`pnpm dev` 会检查 `DATABASE_URL`：本地数据库未运行时自动从 `.local/postgres17` 启动，数据库就绪后再启动 Next.js，开发服务退出时只停止本次启动的数据库。首次初始化或数据库为空时，先单独启动数据库并执行迁移、创建管理员：

~~~powershell
pnpm db:local
~~~

~~~powershell
pnpm db:migrate
pnpm admin:create
~~~

由 `pnpm db:local` 启动的数据库会被 `pnpm dev` 直接复用，不会在开发服务退出时被停止。管理员只创建一次，重复创建会拒绝，避免覆盖既有账户。根脚本默认使用 127.0.0.1:3194。如需使用其他端口，应同时修改启动参数和 .env.local 的 BETTER_AUTH_URL。认证 Origin、登录地址和浏览器访问地址必须一致。

生产预览：pnpm build，然后 pnpm --filter @sohoin/web exec next start -p 3194 -H 127.0.0.1。

后台 /admin，登录页 /admin/login，前台 / 与 /?view=core。初始密码为随机生成，保存在本地 .env.local 的 ADMIN_PASSWORD 中；创建完成后可从运行环境移除 ADMIN_PASSWORD，仅保留自己妥善保存的凭据。

也可使用 compose.yaml：为 Docker Compose 设置 POSTGRES_PASSWORD 后启动 postgres 服务，并使 DATABASE_URL 与该密码一致。不要同时启动两个占用 55432 端口的实例。生产使用独立凭据、HTTPS 和数据库备份。

## 架构与安全边界

- extension-api/settings 提供 Zod 数据契约和类型；extension-api/components 提供组件定制类型；不包含密钥或数据库实现。
- Core server/settings 定义共用设置服务。readAdmin / update 每次从 Better Auth 验证会话并检查 admin 角色及封禁状态，网站直接调用和 APP 的 HTTP 调用走相同检查。
- Web 只装配 Custom 默认值、页面和 HTTP 适配器。Custom 不导入 Core 私有实现。
- Better Auth 自托管；遥测关闭，公开注册关闭。HTTP 认证入口仅开放登录、退出和读取会话，未开放其余用户管理接口。
- 写接口校验 Origin；原生客户端可以不带 Origin，但必须使用有效 Bearer 会话且不携带 Cookie。浏览器 Cookie 写入必须匹配 BETTER_AUTH_URL 来源。
- JSON 请求体有实际流读取上限，设置 16 KiB，登录 4 KiB；不支持表单或任意内容类型。
- Zod 严格字段允许列表，导航只允许站内路径、锚点和 HTTPS，不允许协议相对链接、反斜杠或脚本协议。
- 设置文本作为纯文本由 React 转义，不接受或执行 HTML。Logo 上传复用静态图片媒体服务，另接受解析校验后的受限 SVG，以图片资源展示而非插入 HTML；禁止脚本、外部资源和任意文件；不将设置和媒体校验视为正文内容审核器。
- 登录具备全站及账号限流；Better Auth 还接入 PostgreSQL 原子计数器。设置写入按已验证的用户 ID 限流（30 次/分钟），不会依赖单进程内存。当前未部署边缘 WAF 或大流量防护。
- 不信任客户端声明的角色、作者或任意转发 IP。默认不读取代理 IP；生产如配置 TRUSTED_CLIENT_IP_HEADER，必须由可信代理覆盖并禁止客户端直接访问源站。
- 设置更新使用 revision 乐观并发控制，数据库行锁及事务保证只有一个并发写入成功；审计与设置同一事务保存。
- 不缓存公开设置，避免更新后过期；以后有私密内容时必须另外设计缓存隔离。

## HTTP 契约

GET /api/v1/site-settings：公开设置与 revision。
GET /api/v1/admin/site-settings：管理员读取。
PATCH /api/v1/admin/site-settings：管理员更新，JSON 为 {revision, patch}。
GET /api/openapi.json：从共用 Zod Schema 生成的业务接口 OpenAPI 3.1 描述，可导入 Swagger UI 或 API 工具；尚未嵌入交互式 Swagger 页面。

认证接口 /api/auth/sign-in/email、/api/auth/get-session、/api/auth/sign-out 使用 Better Auth 协议。网站使用 HttpOnly Cookie；APP 可以使用 Bearer 插件签发的会话令牌，不要求自行设计 JWT。APP 登录成功后从 set-auth-token 响应头取令牌，保存在系统安全存储中。退出会撤销服务端会话。

## 验证与维护

pnpm typecheck、pnpm build、pnpm test:security。

安全集成测试要求本地数据库账号有 CREATE DATABASE 权限，使用随机命名的专用临时数据库，执行真实迁移并启动 3195 端口的测试服务；完成后删除临时数据库，不覆盖当前站点设置。测试包含匿名和普通用户越权、非法字段和危险链接、CSRF、体积限制、共同前台生效、并发冲突、限流原子性、APP 会话及退出撤销。

日常数据库维护应清理过期 request_limits 记录；db:migrate 也会清理过期超过一天的计数。认证库升级前审查 Schema 差异，新增迁移并重跑验证。当前未创建自动定时任务。

## 尚未实现

普通用户发帖与审核、富文本过滤、主题后台配置，以及 Custom 任意字段自动生成表单。当前 Custom Header 说明是首个显式声明的专属设置示例，未来字段须加入共用 Schema 与后台表单。

## shadcn 通用后台框架

2026-10-15 已获用户允许接入本次 shadcn 所需依赖。仅安装实际使用的 Radix UI、CVA、cn、lucide-react，以及构建时 Tailwind CSS/PostCSS；未安装暂不使用的 CLI、动画库、表格引擎或表单库。新依赖仍须逐次获得允许。

packages/admin-ui 封装从 shadcn/ui MIT 源码适配的按钮、输入框、文本域、抽屉和表格，以及项目通用的 AdminShell、PageHeader、FormSection、状态提示和空状态。组件采用独立导出入口；不包含认证或数据库逻辑。

后台 /admin 为站点设置，/admin/audit 为只读设置变更记录，/admin/account 为当前账号与退出。登录独立于受保护的 (console) 路由组。尚未接通的业务模块不会出现在菜单中；当前账号页面已接入密码修改、自己的登录会话与远程退出，详见 ACCOUNT-SECURITY.md。

桌面侧栏可折叠，手机使用 Radix Sheet，具备焦点限制、Escape 关闭和焦点恢复。设置表单支持分组跳转、保存状态、撤销未保存修改、离开页面提醒和并发冲突反馈。

样式使用语义类，重复样式集中维护。Tailwind 通过 @reference / @apply 在构建时编译，没有加载 Preflight 或整份全局工具类。后台样式只在 admin 布局中导入，Portal 使用单独的主题作用域。

操作记录读取由 Core listSettingsAudit 统一鉴权。SQL 使用主键游标每次最多取 31 条（30 条展示，额外一条判断下一页），单次 JOIN 查询，无逐条查询和总数扫描；不向页面返回设置修改前后的完整 JSON。GET /api/v1/admin/audit 可供 APP 共用，并已加入 OpenAPI。

性能复核：生产启动后执行 node scripts/measure-pages.mjs。记录 HTML 和首屏链接的 JS/CSS 原始体积、gzip 估算及请求数，并检查首页客户端引用清单不含后台组件。结果不是线上带宽或接口耗时基准；后续改动需使用同一构建环境比较。

后台视觉规范：采用 shadcn 的黑白中性色，主按钮为黑底白字，侧栏与状态使用灰阶；包括错误和成功提示在内均不使用彩色强调，Portal 抽屉遵循同一规范。

后台布局使用 shadcn 官方示例方向：浅灰侧栏、内嵌圆角主面板，基本信息/导航/Custom 设置分组使用 Card 容器；字段分组仍保留 fieldset/legend 语义。卡片不需要新增依赖或客户端交互。

用户管理已接入 `/admin/users`，包括列表、前缀搜索、角色/状态筛选、游标分页、详情和权限状态编辑，详见 [USER-MANAGEMENT.md](./USER-MANAGEMENT.md)。内部链接与搜索表单使用 App Router 切换，未保存编辑具备离开提醒。

内容管理已接入 /admin/content，分类和标签分别位于 /admin/taxonomies/categories、/admin/taxonomies/tags；普通文章支持草稿、发布、下架、删除。详见 CONTENT-MANAGEMENT.md。

## favicon 与 App 图标（2026-10-16）

后台“站点图标”支持分别上传 favicon、App 图标，或从普通 Logo 一键生成，两者仍需保存设置才生效。SVG 原图限 1 MiB，栅格图片限 10 MiB。生成透明 32×32 favicon、白色方底 Apple 180×180、App 192/512 及 maskable 512 PNG，保持比例并留安全边距；不在页面读取时转码。

`icons: {favicon, app}` 保存媒体编号，公开设置只返回固定公开地址；绑定时校验所需变体，沿用 revision、事务审计和媒体行锁。引用中的图标不能删除。上传取消后媒体仍可在库中管理。旧设置自动补为空值，无 SQL 迁移。

根布局接入 favicon、apple-touch-icon 和 `/manifest.webmanifest`；名称和简介来自设置。清单与图标接口 no-store/noindex，不加入 sitemap，不添加新的实体 Schema。已安装应用的图标刷新由浏览器/系统决定；此处不包含离线缓存或 Service Worker。

SVG 可在内部用受限 `@media (prefers-color-scheme: dark)` 和颜色规则自动配色，前台品牌图片按站点实际主题设置 color-scheme；不会强行反转任意多色 SVG。普通/暗黑两张 Logo 仍可分别配置。资源以 img 加载，配合 nosniff、限制性 CSP、sandbox，禁止直接内联上传内容。

本次新增依赖已获用户批准；仅完成代码与回归用例，未运行构建、测试、性能脚本或浏览器。请用户执行 pnpm typecheck、pnpm build、pnpm test:security，并验收上传、生成、保存、清除、深色 SVG 与主屏幕图标。历史测试记录不覆盖本次变更。
