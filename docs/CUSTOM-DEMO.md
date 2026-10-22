# Custom 演示验收

## 目标

验证 Custom 在不导入 Core 私有实现、不修改 DOM 的前提下，替换导航、调整模板、覆盖主题。暂不接入数据库、账号、发布或评论。

## 入口与边界

- Web 的 app/page.tsx 负责按版本选择装配；只有 Web 同时认识 Core 和 Custom。
- Core HomeShell 提供相同静态内容，按公开契约选择 Navigation 和 Page，缺失时使用 UI 默认实现。
- Custom 的 register.ts 返回组件和模板映射。主题由 Custom 模板根节点限定作用范围。
- extension-api 的新 Navigation 替换点和可选模板插槽为加法扩展，API 主版本仍为 1。
- extensions 数组仍为元数据占位，没有增加业务钩子执行器。

## 验收

1. 执行 pnpm install --frozen-lockfile、pnpm typecheck、pnpm build。
2. 执行 pnpm start，打开 /，确认品牌图形与附加说明、左侧导览、绿色主题存在。
3. 点击“Core 默认版”，确认地址变为 /?view=core，导航回到默认实现、导览回到右侧、主题回到基础色。
4. 两版的三段随记、话题链接、原生展开交互均可用；打开浏览器窄屏，确认没有横向溢出，正文排在导览前面。
5. 使用 Tab 和 Enter，确认版本切换、跳过导航、主导航、话题链接、随记展开均可操作。
6. 以后升级 Core 时，只更新宿主维护区，重复以上步骤；Custom 文件不应被升级补丁覆盖。

当前比较页使用服务端查询参数装配，每次切换请求服务端渲染；没有增加客户端状态库或插件扫描器。未声明性能基准，实际成本需随业务增长测量。
