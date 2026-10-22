# Custom 页面与路由

> 当前状态：本文以下内容为保留的历史契约和示例，当前前台未装配 Custom。旧 `/content`、`?view=core` 和捕获路由已移除，不能按本文示例直接访问。当前路由及加密 ID 见 `PUBLIC-SITE.md`；用户提出 Custom 需求后再适配新的公开数据契约。

宿主通过 Next.js App Router 接收请求；Custom 通过静态、可信的代码注册页面。Core 不导入 Custom。无需新增依赖，也不在浏览器运行第二套路由系统。修改注册后重新构建、启动即可生效；不是数据库配置，也不支持后台上传执行代码。

## 1. 替换页面或包装默认页面

在 `custom/pages/index.ts` 导出 `PageOverrides`，`custom/register.ts` 已接入：

```tsx
import type { PageOverrides } from "@sohoin/extension-api/routes";
import { MyHome } from "./home";
export const pages: PageOverrides = {
  Home: MyHome,
  ContentList: ({ children }) => <div className="my-content-list">{children}</div>,
  ContentDetail: ({ content, children }) => <><p>阅读：{content.title}</p>{children}</>,
};
```

含 JSX 时将该文件改名为 `index.tsx`。Home 接收 settings、published；ContentList 接收 page、query；ContentDetail 接收 content。三者均提供 children（默认页面），可以包装，也可以直接返回自己的内容。宿主仍负责公开内容筛选、分页校验和 404；不会把草稿、管理权限或完整用户资料交给公开模板。未配置的页面自动使用默认实现。

详情默认渲染仍先使用 contentTypes 中的类型专属 Template，再回退 ContentArticle；整页 ContentDetail 的 children 就是该结果。已有 components、templates.Page 仍有效。首页 `?view=core` 为演示比较入口，会忽略 Custom 页面/组件覆盖；URL 配置仍为全站统一规则。

## 2. 修改内容 URL

`custom/routes/index.ts`：

```ts
import type { SiteRouting } from "@sohoin/extension-api/routes";
export const routing: SiteRouting = {
  paths: { contentList: "/posts", contentDetail: "/p/[id]" },
  routes: [],
};
```

默认仍为 `/content` 与 `/content/[id]`；首页固定 `/`。列表路径必须全静态，详情路径必须且只能包含一个 `[id]`。地址变更后，原 `/content` 与 `/content/[id]` 通过 307 跳转新地址并保留查询参数。用可逆的临时跳转避免开发期间的永久缓存；正式固定地址时可另行制定 SEO 迁移策略。以前使用过的其他自定义地址不会自动成为历史别名。

宿主首页、列表和分页的链接使用 `apps/web/lib/routing.ts` 的 siteHref。Custom 的服务端代码可用公共工厂生成相同地址：

```ts
import { createSiteRouter } from "@sohoin/extension-api/routes";
import { routing } from "../routes";
const href = createSiteRouter(routing).href;
href.contentDetail("123"); // /p/123
href.contentList({ categoryId: "1", sort: "priority" });
href.custom("/projects/[slug]", { slug: "my-project" });
```

不要在客户端导入包含页面实现的 routing 注册表：在服务端生成 href 字符串后传给交互组件。数据库中的导航、自定义正文和手写外部链接属于显式配置，修改 URL 后需自行更新；系统不会批量重写用户数据。

## 3. 新增页面

```ts
import type { SiteRouting } from "@sohoin/extension-api/routes";
export const routing: SiteRouting = {
  routes: [
    {
      path: "/about", access: "public", title: "关于本站",
      Page: async props => {
        const { default: About } = await import("./about");
        return About(props);
      },
    },
    {
      path: "/projects/[slug]", access: "authenticated",
      Page: async props => {
        const { default: Project } = await import("./project");
        return Project(props);
      },
    },
  ],
};
```

`about.tsx` / `project.tsx` 默认导出 ServerPage<CustomRouteProps> 类型的普通函数或 async 函数。props.params 是已解码的字符串映射；props.searchParams 值为 string / string[] / undefined，查询参数须按页面需求另行校验。返回值为 React 页面。建议用服务端包装器按需 import 页面；含客户端交互时返回对应客户端组件的元素，不要直接调用带 hooks 的组件。

三个访问等级：public（公开）、authenticated（已登录且未封禁）、admin（管理员）。宿主在执行页面和返回标题元数据前调用 Core 身份校验。未登录跳到当前登录入口 `/admin/login`，权限不足或封禁返回 404。当前通用登录入口沿用后台路径，未来前台登录上线时统一调整。页面级门禁不能代替数据接口的对象权限；所有读写继续调用有权限检查的 Core 服务/现有接口，写接口仍须 Origin、输入体积与参数校验。此注册机制只添加 GET 页面，不新增任意 API 或绕过业务服务。

## 4. 路径规则与升级边界

- 首段必须是静态小写英文/数字/短横线；后续可用静态段或 `[name]` 单段参数。最多 8 段、200 字符、64 条自定义路由。
- `/admin/**`、`/api/**`、`/_next/**` 和原 `/content/**` 保留给宿主。首页通过 Home 覆盖，不注册 `/`。
- 重复和可能重叠的规则一律报错，包括 `/projects/new` 与 `/projects/[slug]`。可以把新建页放到 `/create-project`。不依赖数组顺序抢占匹配。
- 暂不支持 catch-all、可选参数、正则路由或任意中间件；未匹配返回 404。
- Custom 是可信源代码，不是沙箱。新增宿主路由时，同步加入保留前缀并回归测试，避免宿主文件路由优先级遮挡 Custom。
- 升级保留 `custom/**`。宿主只维护通用入口与公开契约；不得覆盖站点注册和页面实现。当前新增的空注册文件只用于首次搭建。

## 5. 性能与验证

路由表在服务端模块初始化时校验和编译，单次匹配最多 64 条、每条 8 段；无数据库路由查询、无浏览器路由表下载。默认服务端渲染；只有实际交互组件需要浏览器 JS。页面仍通过 Next Link 获得客户端导航。新增路由注册文件本身不会扫描文件系统或下载所有页面到浏览器。页面 CSS/客户端依赖仍需按页面隔离，避免放到全站 layout。

`pnpm test:routing` 验证默认/改名路由、中文参数、链接编码、保留前缀、冲突与越界路径。另已用临时生产构建验证公开与动态页面、首页/列表覆盖、旧入口跳转、未知及不存在内容 404、匿名门禁和管理员访问；临时页面在验证后移除。

本次默认生产页面测量：首页和内容列表各增加 1 个 Next Link 资源请求，JS 原始体积 +7,821 字节（gzip 估算 +3,306 字节）；CSS 不增加。后台内容页 HTML/JS/CSS 与改动前一致；公开页面客户端清单未包含 admin-ui / Radix / lucide。路由匹配本身不增加客户端运行时，这部分增加来自公开页的 Next Link 导航支持。报告在 `.local/performance/routing-before.json` 和 `routing-after.json`。
