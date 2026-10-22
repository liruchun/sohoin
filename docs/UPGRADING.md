# Core / Custom 升级边界

## 所有权与依赖

- packages/core、packages/ui、packages/extension-api、packages/database：宿主维护区。
- apps/web：薄宿主与装配层；升级时审查差异，保留 Custom 注册调用与样式导入。
- custom/**：项目自有区。不得在宿主发布包、更新脚本或路径补丁中覆盖、删除或重置。
- 根配置与锁文件：共享基础设施，需要审查和合并。

依赖方向：Web → Core / Custom；Core → UI / extension-api / database；Custom → extension-api。Custom 以后可使用公开 UI 导出，但不得导入 Core 私有文件。UI 与公开 API 不得反向依赖 Core 或 Custom。

## 升级步骤

1. 将当前工程和 custom 纳入版本控制并提交备份。
2. 在独立分支选择性合并宿主 packages/** 的更新；审查 apps/web、根配置和锁文件的必要改动。不要复制整个项目根目录。
3. 确认 custom/** 没有升级引入的改动；保留 Web 的 registerCustom 与 Custom 样式入口。
4. 检查公开扩展 API 的兼容性。破坏性变更须升级 API 主版本并给出迁移说明；旧 Custom 需要显式迁移，不能承诺永久免修改。
5. 执行 pnpm install --frozen-lockfile、pnpm typecheck、pnpm build，人工检查定制组件和模板。
6. 以后有数据库迁移时，单独备份数据并审查迁移；数据库结构使用 packages/database/migrations 的增量 SQL 迁移，保留设置、认证数据和审计记录。

目前尚未配置远程仓库或自动升级渠道。当前结构通过目录所有权、显式接口和单向依赖支持后续升级；不包含自动更新器。

新增升级校验：应用迁移前备份 PostgreSQL；禁止修改已应用 SQL 文件。保留 Custom 默认设置与字段契约，执行 pnpm test:security（专用本地测试库）。数据库设置数据不属于宿主源码，升级不得重新初始化或清空。
