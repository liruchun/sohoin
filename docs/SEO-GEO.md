# SEO / GEO 开发规范

核验日期：2026-10-15（Asia/Shanghai）。适用项目：sohoin（sohoin.com），面向超级个体、独立开发者、独立站从业者、外贸人等 SOHO 人群的轻社交系统；Next.js App Router + Core/Custom 架构。

本文将 Google 官方原则转为本站开发与验收要求。GEO 指生成式搜索可见性，不是地理定位。下文“本站要求”包含团队实施选择，不全部等同于 Google 的硬性收录条件。规范建立不代表现有页面已完成全部功能或 Google 已收录本站。

## 1. 必须随功能完成

**新增或修改页面、路由、内容类型、媒体、用户公开资料或发布状态时，必须同时判断并补齐适用的 SEO/GEO 功能，不得把缺失的 H1、metadata、索引控制或必要结构化数据留作默认的“以后优化”。** 同一任务中完成可确定、属于当前范围的实现及验证。若依赖正式域名、公开性决策、媒体字段或站长账号配置，先完成不依赖它们的部分，再明确记录具体缺口；不得虚构数据，也不得宣称已验收。

- 开发前确定：是否公开、是否值得索引、主要实体是什么、规范 URL 是什么。
- 开发中同步完成：语义 HTML、标题/摘要、canonical、robots/noindex、适用 JSON-LD、内链和状态码。
- 发布/编辑/归档/删除时同步失效相关缓存，更新 sitemap 与结构化数据的可见范围。
- 开发后检查实际响应、HTML、元数据和结构化数据；不能只确认浏览器看起来正常。
- 优先 Next 原生 Metadata / robots / sitemap 能力及共享 Core 服务，不为这些基础功能新增 SEO 插件。任何新依赖仍遵守 AGENTS 授权要求。
- Custom 暂不启用新定制；将来使用时必须遵守同一套 SEO 契约，不能因替换模板丢掉主标题、公开性或索引控制。

## 2. Google 原则与 GEO 边界

Google 的生成式 AI 搜索仍依赖可访问、可索引且符合质量要求的内容；没有独立的 GEO 技术通关清单。不为“AI 收录”添加专属 Schema、隐藏文本或 `llms.txt`。这类文件若因其他系统确有用途，可另行评估，不能称为 Google 的必要条件。达到要求也不保证被收录、排名或被 AI 引用。参考：[Google AI 优化指引](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。

本站要求：优先真实原创经验、明确主题、自然分段、可核实的作者与来源；有必要时给出摘要、事实依据和引用链接。不是所有帖子都强行改写成问答或固定长度。不能批量制造关键词变体、假作者/假评价，或把采集演示帖子当作本站原创发布。

有索引资格的页面仍受部署、CDN 与站长设置影响。正式上线时核对当时 Search Console 中适用的 AI 搜索纳入设置、站点验证与可用效果报告；不能仅凭代码推定账号已启用。Google 2026 年 AI 优化指南包含这些运营入口，旧版 AI Features 文档的报告说明可能不同，以最新官方说明及实际账号为准。本站代码开发不自动授权修改站长平台、DNS 或提交线上站点。

## 3. 主标题、正文和文本信息

每个完整 HTML 页面设置明确、可访问的页面主标题。**本站默认一个 H1**；它是语义/一致性约定，不是“Google 规定必须恰好一个 H1”的排名门槛。H2/H3 按内容层级组织，不能为了字号把普通文字换成标题标签。参考：[Google 标题链接指南](https://developers.google.com/search/docs/appearance/title-link)。

- 首页 H1 描述社区；分类页描述分类；文章详情 H1 为真实文章标题。连续信息流的每条帖子不是一个页面 H1，可用 article 内的 H2 或其他恰当结构。
- 无标题短帖用正文的准确摘句，或“作者的帖子”等自然描述建立详情页标题，不生成夸大主题或堆关键词。页面标题、metadata 与 JSON-LD 的主题须一致。
- 主标题优先可见且不破坏 DESIGN 的层级。只有界面确实不适合展示重复标题时，才使用合适的 sr-only 可访问标题；不得做面向爬虫的隐藏关键词。
- 正文、重要作者信息、分类和公开链接在服务端 HTML 中有可读表达；不等待用户滚动、点击、登录或执行事件后才提供整页核心内容。正文与评论分页可有界展示，不因此无界加载全部历史。
- 使用 main / article / nav / time 等合适语义，正确设置页面 lang。语义 HTML 服务于理解和无障碍，不保证搜索排名。

## 4. Metadata 与 URL

本站品牌为“sohoin”，正式目标域名为 sohoin.com；基础介绍可采用“面向超级个体、独立开发者、独立站从业者、外贸人等 SOHO 人群的轻社交系统”。实际 metadataBase、canonical、WebSite 名称、JSON-LD 标识与 sitemap 统一使用受信任的正式部署配置；不能因此改掉本地认证 Origin，也不能把计划域名当成已上线事实。

每个可索引页有准确且能区分页面的 title、必要的 description；详情不能只继承站名。Google 可按查询重写标题或摘要，不以固定字符数作为官方硬门槛。分享用 Open Graph 等标签按需提供；它们不替代正文和索引控制。参考：[标题指南](https://developers.google.com/search/docs/appearance/title-link)、[摘要指南](https://developers.google.com/search/docs/appearance/snippet)。

- 使用 Next Metadata API 统一处理，避免在组件中散落多个 title、robots 或相互冲突的 canonical。
- 正式绝对 URL 由受信任的站点配置生成，不从任意 Host / Forwarded 请求头推导。正式域名未确定时不得编造域名、把 localhost 或预览域名发布为正式 canonical。
- 同一内容的等价 URL 使用一致 canonical；站内链接、sitemap、JSON-LD 的 url / @id 与之对齐。canonical 是规范化信号，不是权限或禁止索引手段。
- 不把所有分类页、详情页、真实分页都 canonical 到首页。内容不同的分页不能因为需要“去重”而全指向第一页。
- 仅跟踪参数等可等价归一的参数可从 canonical 中去除。筛选和排序按页面价值单独决策；内容不等价时不能强行规范化。
- 正式永久改地址优先评估 301/308，保留可逆的开发阶段跳转选择。已有路由机制的临时 307 不应在域名/路径未定时盲目改成永久跳转。

参考：[canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)、[分页](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)。

## 5. 索引策略与 noindex

下表是本站默认策略。**公开可访问 ≠ 自动值得索引**；index 也不是收录保证。个人资料是否公开、敏感内容是否允许展示等产品决定不能由 SEO 自行扩大。

| 页面/资源 | 默认处理 | sitemap / 结构化数据 |
|---|---|---|
| 评论独立详情 | 默认 noindex,follow；canonical 指向所属帖/文章；不进入 sitemap，页面仍渲染真实内容和 Comment | 不加入 sitemap；结构化数据与可见内容一致 |
| 正式首页、正常公开内容详情 | 满足质量/可见性条件后允许索引 | 收录规范 URL；添加适用真实实体 |
| 有内容和独立价值的分类归档 | 允许索引，自有 H1/metadata | 可加入 sitemap；层级真实时加面包屑 |
| 公开用户主页 | 公开决策明确、资料有价值时评估索引 | 满足条件才用 ProfilePage |
| 站内搜索、低价值参数组合/筛选 | 本站默认 noindex，不批量生成可索引变体 | 不加入 sitemap；不作为其他内容的 canonical |
| 后台、账号、消息、私有收藏、登录/找回 | 权限控制 + noindex；公开登录入口也 noindex | 不加入 sitemap，不输出私有实体 |
| 草稿、预览、已隐藏/私有内容 | 保持鉴权/不可公开；可展示的预览 noindex | 不输出为公开内容，不泄露在 JSON-LD |
| 被删除或不存在的公开内容 | 正确 404/410；权限不可见按服务约定处理 | 移除 sitemap，不伪装成 200 的正常文章 |
| 演示/采集内容及演示资料 | noindex；正式公开列表默认排除演示记录 | 排除 sitemap 与面向搜索的实体/计数 |
| 开发、测试、预览部署 | 默认禁止索引；需要时增加访问限制 | 不暴露正式 sitemap，不承接正式 canonical |
| JSON/API、非搜索落地页资源 | 视用途用响应头 X-Robots-Tag: noindex；私有接口仍鉴权 | 不进入网页 sitemap；公开媒体另行判断 |

关键区别：

- `robots.txt` 的 Disallow 管抓取；`noindex` 管搜索索引；canonical 管重复 URL。三者不可互换。
- 爬虫需要能读取 noindex。公开页面如果同时被 robots.txt 禁抓，Google 可能读不到页面上的 noindex，URL 仍可能因外链而被发现。不要把“Disallow + 页面 noindex”当作必然生效的删除方案。
- robots.txt 不是权限措施；敏感页面先鉴权，不能把数据交给浏览器再靠 noindex 保护。受保护后台的 Disallow 可用于抓取管理，但不能把不可读取的 noindex 当作唯一保障。
- HTML 用 robots metadata，非 HTML 用适用的 X-Robots-Tag；检查反向代理/CDN 与页面标签是否冲突，较严格限制可能阻止原本想索引的内容。
- 不默认全站 nofollow。用户提交的外链按真实性质使用 rel="ugc"，广告/付费链接使用 sponsored，必要时与 nofollow 组合；不影响本站正常的公开内容内链发现。

参考：[noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)、[robots metadata / X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)、[链接规则](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)。

## 6. 结构化数据按真实类型补齐

当当前页面符合 Google 支持类型、具备所需真实数据且对搜索有意义时，**必须随页面实现适用的 JSON-LD**；不因为界面已经能用而省略。若类型不合适或缺少关键真实字段，记录原因并不输出伪造数据。结构化数据提升机器理解和相关搜索展示资格，不保证富结果，也不是 Google AI 功能的额外必要条件。[通用规则](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)。

| 场景 | 类型与边界 | 官方依据 |
|---|---|---|
| 首页站点身份 | WebSite；真实运营主体明确时再评估 Organization，不把普通用户当机构 | [站点名称](https://developers.google.com/search/docs/appearance/site-names) |
| 编辑型文章/博客详情 | Article 或 BlogPosting；实际标题、作者、发布日期、适用配图，不把全部社区帖子都标为新闻 | [Article](https://developers.google.com/search/docs/appearance/structured-data/article) |
| 用户社区帖子及讨论详情 | DiscussionForumPosting；根据支持范围评估 SocialMediaPosting，评论可用 Comment，准确表达当前展示的讨论 | [社区讨论](https://developers.google.com/search/docs/appearance/structured-data/discussion-forum) |
| 单一公开用户主页 | ProfilePage + 真实 Person 等主实体；不是用户管理列表或私有账号设置 | [ProfilePage](https://developers.google.com/search/docs/appearance/structured-data/profile-page) |
| 有真实导航层级的页面 | BreadcrumbList，与用户能理解的站点层级一致 | [面包屑](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) |
| 以可观看视频为主要内容的页面 | VideoObject；提供真实名称、缩略图、上传时间以及可用内容/嵌入地址等适用字段 | [VideoObject](https://developers.google.com/search/docs/appearance/structured-data/video) |
| 多帖子列表 | 可评估 ItemList/Collection 表达列表；不能假称其中一条为整页主实体，不能标记未展示的全部评论 | [列表讨论规则](https://developers.google.com/search/docs/appearance/structured-data/discussion-forum) |

实施要求：

- schema.org 允许的字段与 Google 支持的富结果并不相同；按相应官方类型文档检查必填/推荐属性。普通列表使用 ItemList 不自动获得轮播富结果。
- JSON-LD 只描述用户能访问、与页面一致的内容。评论“可见”可包含用户正常展开可见的内容，不要求全部默认展开；但不能将私有、隐藏、删除、未提供的回复或管理字段塞进数据中。
- 作者名称/URL、发布日期、正文、媒体、计数必须来自共享服务的真实公开数据。dateModified 只反映有意义的内容修改，不用每次请求的当前时间伪造更新。
- 讨论数据保留实际回复结构；JSON-LD 可以只包含当前页面提供的有界评论，不为 SEO 读取或输出全站/整帖全部历史。总计数与当前评论样本数量可以不同，但必须语义准确。
- 演示昵称、聚合导入表情和采集正文不能用于伪造本站真实声誉，正式索引数据排除本批演示记录。论坛/点赞计数不伪装成商品星级评价；普通讨论不能为了富结果改标 QAPage 或 FAQPage。
- 安全地序列化 JSON-LD，转义 HTML 脚本上下文中的小于号等危险字符，避免 UGC 的脚本结束标签逃逸；不把用户文本直接拼接成 script HTML。
- 服务端一次生成适用实体，复用 @id，避免 layout、模板、类型模板各输出一份冲突实体。没有结构化数据的页面不为了“全覆盖”增加无关 Schema。

## 7. 可抓取导航、分页与状态

公开内容链接使用真实的 a href；Next Link 最终应输出可发现的链接。只有 onclick、按钮切换、图片事件或必须执行交互才出现的链接，不能作为唯一发现路径。锚文本说明目标，图片链接提供适当 alt。[链接指南](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)。

- 信息流可以无刷新导航和加载更多，但需有可访问的分页 URL/链接或其他稳定公开发现路径，不能依靠 Google 点击“加载更多”。SEO 与有界游标分页兼容，不要求一次下载全部数据。
- 各有效分页有自己的 URL，用户直接访问可得到对应内容；分页链接能逐页发现后续内容。不要把分页全部 canonical 第一页，也不以无限参数组合制造抓取陷阱。
- 不存在内容走 Next notFound 或正确 HTTP 语义；服务器异常不长期返回带错误文案的正常 200 页面。Next 流式响应可能影响已发送状态，实施时检查真实响应并尽可能在开始流式输出前判断不存在/权限。
- 用户归档、封禁、撤销公开、删除、审核隐藏、恢复时，正文、metadata、JSON-LD、缓存、sitemap 一起遵守当前可见性；不从 SEO 分支绕过 Core 权限。

参考：[分页与增量加载](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)。

## 8. Sitemap、robots 与环境切换

正式上线时补齐由可信站点配置生成的 robots.txt 与 sitemap。sitemap 只包含可公开索引、有效且规范的 URL，不包含管理、私有、演示、跳转和失效地址。lastmod 使用有意义的修改时间，不使用每次生成时间；Google 不依赖 priority/changefreq。单文件受 50,000 URL / 未压缩 50MB 限制，规模增长时拆分。[官方 sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)。

实现时用有界、按索引读取的最小数据投影，不能每次请求逐条加载完整文章/评论或全库放入内存。缓存与发布状态失效机制需配套，避免长时间暴露已隐藏地址。正式域名切换前同时检查 CDN 的 noindex、robots、canonical 与 sitemap URL，不能把测试环境 noindex 带入正式公开页面。

“允许抓取”和“禁止索引”要按第 5 节协调；不得在 robots.txt 写 noindex 来代替受支持的页面/响应头指令。

## 9. 图片、视频和页面体验

图片使用有意义的 alt，与正文相关；纯装饰图片 alt 为空。关键图片用实际 img/picture 及可访问资源地址，不仅藏在 CSS background。提供合理尺寸、响应式资源和预留空间；不把首屏重要图片一律懒加载。[图片指南](https://developers.google.com/search/docs/appearance/google-images)。

公开内容的媒体需要真正可访问且受 Core 可见性规则保护的资源入口；不能把需要管理员登录的媒体管理接口地址直接写成公开图片、视频或 JSON-LD URL。设计公开媒体访问能力时同步补权限、缓存及撤销公开处理，不为爬虫绕过资源权限。

视频提供真实可播放内容、封面及有意义的上下文，不能只有无法访问的播放器壳或假 VideoObject。普通帖子中的视频不必自动建设独立视频索引页面；确定要做视频搜索落地页时，按视频索引与结构化数据文档实施。[视频文档](https://developers.google.com/search/docs/appearance/structured-data/video)。

控制 HTML/JS/CSS、媒体和字体体积；为 SEO 增加的 JSON-LD 也计入 HTML 成本。SEO 不能成为无界查询、复制正文、额外阻塞请求或整页客户端化的理由。关注 LCP、INP、CLS；本站采用良好体验目标 LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1，按适用的真实用户第 75 百分位评估。开发机/Lighthouse 单次测量不能替代真实用户体验，也不承诺排名。[Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)。

## 10. 摘要与 AI 展示控制

默认公开内容可根据业务目标参与搜索；如果需限制摘要/AI 使用，再评估 nosnippet、max-snippet、data-nosnippet 等预览控制。不要在希望正常参与 AI 搜索的页面无差别禁用所有摘要。noindex 会更广泛地影响索引，不能把它当作仅退出 AI 的开关。[AI Features](https://developers.google.com/search/docs/appearance/ai-features)、[预览控制](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)。

限制正文摘要不等于所有其他渠道数据都停止使用，结构化数据等授权内容另有适用规则。Google-Extended 与 Googlebot 的搜索抓取/展示控制属于不同范围，不把二者等同；新增跨平台 AI 爬虫策略时需另核对对应服务的官方说明，不假定 Google 的规则适用于所有引擎。

## 11. 每个任务的完成检查

涉及页面/路由/可见性/媒体/发布流程的任务，交付时至少能回答：

- [ ] 页面主标题和 H1 是否明确、合理；title/description 是否对应真实内容？
- [ ] 当前环境和页面允许索引吗？metadata、响应头、robots 是否协调？
- [ ] canonical、站内 href、JSON-LD URL 与 sitemap 是否使用相同的规范地址？
- [ ] 适用结构化数据是否已实现；不适用或缺字段是否有明确原因？
- [ ] JSON-LD 与可见内容一致、可解析且安全，没有私有/演示/虚假字段？
- [ ] 核心正文和发现链接是否在可抓取 HTML 中；分页是否有界且可直达？
- [ ] 隐藏/删除/权限变化、404/重定向和缓存失效是否同步？
- [ ] 图片、视频、移动端、无障碍及 HTML/JS/CSS 负担是否达标？

实施后的验证按影响选择：类型检查/构建；HTTP 状态、头与 HTML 断言；JSON-LD 解析、必需字段、恶意 UGC 转义、未授权数据不泄露、noindex 不误伤的针对性测试；分页/可见性回归。公开部署后，在已授权范围内使用 Rich Results Test / Search Console URL Inspection 检查 Google 实际读取的内容，再观察索引、搜索/AI 效果和核心体验报告。未部署、未获得账号访问或未提交验证时如实说明；不能将本地测试写成 Google 已验证。

## 12. 来源维护

本文根据各节链接的 Google Search Central 官方文档总结，未采用第三方“保证收录/AI 引用”的技巧。Google 支持的类型和后台控制会变化；实施具体类型或对外发布前核对相关最新文档。本站的默认单 H1、低价值搜索页 noindex、演示内容排除等属于项目策略，不冒称 Google 对所有网站的统一强制规则。
