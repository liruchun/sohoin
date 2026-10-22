# 勋章底层与后台管理

勋章与积分独立，不随积分消费而收回。当前提供勋章定义、授予、撤销、重新授予、私有查询和审计；已接入后台人工管理及受保护的 HTTP 接口；没有自动规则、预置荣誉、积分联动、消息通知或前台展示。没有新增依赖。

## 数据与语义

追加迁移 `029_badges.sql` 创建三张表：

| 表 | 用途 |
| --- | --- |
| badges | 稳定 key、名称、说明、启停、版本及时间 |
| user_badges | 用户与勋章的唯一当前状态，保留有效/已撤销、版本、授予/撤销时间 |
| badge_audit | 定义变更及授予/撤销审计，保存前后状态、操作主体、原因、业务来源与幂等请求 |

`key` 是服务端使用的稳定标识，不是公开 URL。定义名称与说明按纯文本处理；图标通过现有媒体库关联，上传 PNG/JPEG/WebP 后沿用现有重编码流程。只接受本地可用 WebP 图片，不引入任意外链图标或 HTML；前台佩戴展示尚未接入。

同一种勋章每人最多一个有效状态，不叠加数量。再次授予已有效的勋章不改变状态或授予时间，但记录这次新业务请求，`changed=false`。撤销后可以以新的幂等键重新授予，版本递增，授予时间更新；旧时间仍保留在审计中。

停用定义只阻止新的授予请求，不自动撤销已有勋章，也不在本人查询中隐藏已有勋章。停用期间仍能撤销；之前成功请求的幂等重试仍返回原结果。没有硬删除接口；定义和用户外键保留审计，不能直接硬删除有关联记录的用户，后续注销须另定匿名化方案。

## 服务端接口

```ts
import {
  createAdminBadgeService,
  createSystemBadgeService,
  listOwnBadges,
} from "@sohoin/core/server";

const admin = createAdminBadgeService(headers);
const definition = await admin.createDefinition({
  key: "example-badge",
  name: "示例勋章",
  description: "清晰说明获得该勋章代表什么",
  enabled: true,
  reason: "创建原因",
});

await admin.updateDefinition({
  key: definition.key,
  name: definition.name,
  description: definition.description,
  enabled: false,
  revision: definition.revision,
  reason: "停用原因",
});
await admin.listDefinitions({}); // 每页 30 条，返回 items、nextCursor
await admin.listDefinitions({ before: cursor });
await admin.listAudit("example-badge", {});

// 仅供可信服务端代码使用；标识不得来自请求体。
const badges = createSystemBadgeService("example-service");
const result = await badges.grant({
  userId,
  badgeKey: "another-enabled-badge",
  idempotencyKey: "example-award:record-id",
  sourceType: "example",
  sourceId: "record-id",
  reason: "明确的授予原因",
});
// 返回 { state, auditId, changed, replayed }

await badges.revoke({
  userId,
  badgeKey: result.state.badgeKey,
  revision: result.state.revision,
  idempotencyKey: "example-revoke:record-id",
  sourceType: "example-revoke",
  sourceId: "record-id",
  reason: "明确的撤销原因",
});

await badges.listUserBadges(userId, {}); // 含已撤销状态，限可信内部调用
// admin 也提供 grant、revoke、listUserBadges。
await listOwnBadges(headers, {}); // 只能查当前登录用户的有效勋章
```

上述 key 和原因仅为接口示例，不会创建预置勋章，也不接通任何奖励条件。系统服务只能授予、撤销与查询用户状态；定义管理和审计查询由管理员服务提供。

定义列表与用户列表按 key 升序分页，`before` 是沿用现有接口命名的继续游标，传上页 `nextCursor` 即可；审计按数字 ID 倒序。全部单页最多 30 条，无总数查询。服务协议和严格参数校验位于 `@sohoin/extension-api/badges`。

本人查询只返回 key、名称、说明、授予版本与时间，不返回来源对象、授予原因、系统或管理员身份。后台新增用户勋章、获得者及审计查询，均须管理员权限。当前没有开放按任意用户查询的公开接口，也没有作出公开展示决策。

## 权限、并发与重试

- 管理员身份由现有会话派生，并在数据库事务中使用现有权限锁复查；请求不能指定 actor 或跳过权限检查。
- 每次写入在同一事务中更新状态和插入审计，审计失败则整体回滚。审计触发器拒绝 UPDATE、DELETE 和 TRUNCATE。
- 授予/撤销按用户行串行化，保证首次授予和跨勋章幂等键不会发生竞争。定义读锁阻止启停与授予之间产生状态检查竞态。
- 幂等键在用户范围内唯一，必须包含稳定业务命名空间。相同键和完全相同参数返回原审计结果；换勋章、操作、来源、原因、操作主体或撤销版本都会报冲突。
- `replayed=true` 的 `state`、`changed` 是原操作的历史结果，不表示当前状态。例如旧授予请求在撤销后重试，不会重新激活。需要当前状态时重新查询，不能依据历史结果重复执行业务副作用。
- 撤销必须携带观察到的版本，版本变化后拒绝新的旧版本撤销请求，避免误撤销重新授予的勋章。对已经撤销的当前版本执行新撤销请求是无变化的审计操作。
- 定义修改要求当前 revision，不允许改 key；完整提交名称、说明、启停和原因。

系统接口仍只供可信服务端代码使用；自动授予资格判断属于业务层。后台 HTTP 写接口固定管理员身份与 manual 来源，检查来源、8192 字节请求体上限及严格参数，所有响应 no-store。当前各方法独立提交，不提供与积分/其他业务共用事务的接口，不能将多次服务调用描述为原子联动。

## 主要错误

| 错误码 | 含义 |
| --- | --- |
| INVALID_BADGE_INPUT | 参数、游标或版本无效 |
| BADGE_NOT_FOUND / BADGE_USER_NOT_FOUND | 勋章或用户不存在 |
| BADGE_DISABLED | 勋章停用，不能新授予 |
| BADGE_ALREADY_EXISTS | 定义 key 已存在 |
| BADGE_REVISION_CONFLICT | 定义或用户勋章版本已变化 |
| BADGE_IDEMPOTENCY_CONFLICT | 相同业务键对应不同请求 |
| BADGE_AWARD_NOT_FOUND | 用户尚未获得此勋章，无法撤销 |

认证、权限和限流错误沿用 Core。数据库异常不会伪装成成功。

## 维护与验证

三张表已加入备份清单行数核对；旧备份仍按其实际表清单验证。`pnpm db:check` 检查当前状态与最新授予/撤销审计的有效状态和版本是否一致，并检查缺失的用户勋章记录。这些检查只在手动维护时运行。

`packages/core/tests/badges-cases.ts` 已接入 `pnpm test:security`，覆盖授权、伪造参数、定义版本竞争、启停、并发幂等、重复授予、撤销/重新授予、旧请求重放、审计失败回滚、私有字段裁剪、游标分页和审计不可修改。

本次仅编写代码和测试，未执行迁移、类型检查、构建或测试。由用户执行 `pnpm db:migrate`，以及 `pnpm typecheck`、`pnpm build`、`pnpm test:security`。安全测试按既有流程创建专用测试数据库，不直接对业务数据库运行测试文件。

## 后台人工管理

- `/admin/badges`：勋章列表，展示图标、名称、说明、启停与更新时间。
- `/admin/badges/new`：创建勋章，自动生成稳定标识；可上传图标或从媒体库选择。
- `/admin/badges/[key]`：基本信息、当前获得者、操作记录三个入口；启用的勋章可选择用户手动授予。
- `/admin/users/[id]/badges`：查看有效和已撤销的勋章，授予、撤销，以及查看用户的勋章历史。用户资料页新增导航入口。

授予和撤销复用后台确认弹窗。授予选择器对已拥有和停用勋章禁选；全局入口通过姓名/邮箱前缀分页查找用户。表单填写原因后才能提交，失败保留输入，同一请求重试复用 requestId；创建请求也使用稳定 requestId 派生 key，重复创建返回冲突而不产生第二条定义。定义编辑保留 revision 冲突检查。

追加迁移 `030_badge_icons.sql` 为 badges 增加 icon_media_id 及相关查询索引；不修改已执行迁移。图标关联在事务内锁定并检查媒体可用性，媒体列表标记为使用中，媒体删除检查勋章引用，完整性检查也核对图标状态；移除引用后才允许删除。图标只通过管理员媒体接口读取，不新增公开媒体路径。

HTTP 接口：

| 路径 | 方法 | 用途 |
| --- | --- | --- |
| `/api/v1/admin/badges` | GET / POST | 列表 / 创建 |
| `/api/v1/admin/badges/[key]` | GET / PATCH | 详情 / 修改 |
| `/api/v1/admin/badges/options` | GET | 用户选章列表，支持 key 精确查询与分页 |
| `/api/v1/admin/badges/grants` | POST / PATCH | 手动授予 / 撤销 |

已同步 OpenAPI。页面为动态服务端读取，只有编辑与操作弹窗客户端化，继承后台 noindex，不进入公开 sitemap，不输出公开 JSON-LD。前台不引用后台组件或勋章图标接口。

新增 `badges-admin-cases.ts` 并加入安全测试：权限、跨站请求、请求体上限、版本冲突、图标引用和删除保护、授予重试、撤销、私有页面及接口文档。未代跑迁移、类型检查、构建、测试、性能测量或浏览器。除既有检查外，后台 UI 变更由用户用 `scripts/measure-pages.mjs` 检查生产资源和前后台隔离。
