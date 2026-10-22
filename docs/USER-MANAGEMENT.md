# 用户管理

后台入口 `/admin/users`；列表和详情由服务器渲染，导航、搜索和分页使用 App Router 局部切换。沿用黑白卡片后台，无新增依赖。

用户详情新增“勋章”与“勋章记录”导航，入口为 `/admin/users/[id]/badges`。支持选择勋章授予、填写原因撤销及查询历史；共用全局勋章管理的操作组件和服务，详见 [BADGES.md](BADGES.md)。

## 能力与边界

- 搜索姓名或邮箱前缀，筛选角色（普通用户/管理员）及状态（启用/禁用）。特殊字符按字面匹配，不作为 SQL 通配符。
- 用户编号倒序、主键游标分页，每页展示最多 30 条，查询最多 31 条；不查询全表总数，不逐行查数据库。前缀索引支持姓名、邮箱筛选；大规模数据需按实际查询分布复核执行计划。
- 查看姓名、邮箱、邮箱验证状态、注册时间和用户编号；不向页面返回密码、账户令牌或会话信息。
- 编辑角色、状态及禁用原因。版本冲突返回 409，要求刷新，不静默覆盖。
- 不允许通过用户管理修改当前管理员自己的访问权限；保留至少一位启用的管理员。权限变更以事务级锁串行处理，并在锁内重新检查操作者权限，防止两个管理员并发互相降权后全部失去管理权限。
- 每次成功更新均在同一事务中写入 `user_admin_audit`，撤销目标用户的全部会话。启用账号后须重新登录；禁用为无限期禁用。后台“操作记录”的“用户管理”分类可查看权限记录，采用独立游标分页，不返回原始修改前后 JSON。
- 本阶段不开放公共注册，不提供新增用户、删除账号、修改邮箱/密码、批量操作；已有管理员通过现有初始化脚本创建。

## 共享服务与 API

`packages/extension-api/users` 定义输入及输出契约，`packages/core` 的 `listUsers` / `getUser` / `updateUser` 统一鉴权、限流、校验，数据库层负责参数化查询和原子写入。后台读取直接调用服务；Web 的编辑和后续 APP 使用相同服务的 HTTP 适配器。

- `GET /api/v1/admin/users?q=&role=all&status=all&before=`，`before` 为上一页返回的 `nextCursor`，无游标时应省略该参数。
- `GET /api/v1/admin/users/{id}`。
- `PATCH /api/v1/admin/users/{id}`，JSON 形如 `{ "version": 0, "patch": { "banned": true, "banReason": "原因" } }`，或 `{ "version": 0, "patch": { "role": "admin" } }`。
- 写入需校验 Origin；无 Cookie 的原生 APP 支持 Bearer 会话。JSON 最大 4 KiB，字段使用严格允许列表。用户查询限每位管理员每分钟 120 次，写入 30 次。
- 接口已纳入 `/api/openapi.json`；不会直接开放 Better Auth 的管理员 HTTP 接口。

迁移为新增的 `003_user_management.sql`，不修改已应用迁移，不覆盖 Custom。

## 验证

`pnpm typecheck`、`pnpm build`、`pnpm test:security`。安全集成测试使用独立临时数据库，覆盖越权、来源、字段校验、搜索与分页、禁用及会话撤销、版本冲突、审计、自我保护和管理员并发。

`node scripts/measure-pages.mjs .local/performance/users-after.json` 记录生产 HTML/JS/CSS，并检查公开首页不引用后台组件。产物体积不等于线上耗时；生产部署仍应根据真实负载评估数据库查询。
