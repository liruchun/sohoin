# 积分底层

当前只提供服务端账户、流水、入账、扣减、冲正和查询。没有触发规则、兑换场景、前台页面或 HTTP 路由，也没有新增依赖。入口为 `@sohoin/core/server`，协议类型和校验为 `@sohoin/extension-api/points`。

## 账户与记账

- `points_accounts.user_id` 一人一账户，首次成功记账时创建；已有用户尚未记账时余额为 0，查询不创建账户。`accountId` 就是内部用户 ID，不另造一套账号编号。
- 积分使用整数，单次数量与余额上限为 `Number.MAX_SAFE_INTEGER`。数据库使用 bigint，运算使用 BigInt，返回安全整数；流水 ID 和游标保持字符串。
- `points_entries` 保存有符号变动、记账后余额、来源、原因、操作主体和冲正关联，本身承担记账审计。更正须追加反向流水；数据库触发器禁止更新、删除和清空流水。
- 余额与流水在同一连接、同一事务内更新。同一账户行锁串行化写入，扣减不允许负余额；不同账户可以并发。
- 保留账户和流水的外键禁止直接硬删除有积分账户的用户。后续如做注销，应另行定义身份匿名化与账目保留方案，不能级联清空历史。

## 服务入口

```ts
import {
  createSystemPointsService,
  createAdminPointsService,
  getOwnPointsBalance,
  listOwnPointsEntries,
} from "@sohoin/core/server";

// 仅在可信服务端业务中构造，名称是稳定的系统操作主体。
const points = createSystemPointsService("example-service");

const result = await points.credit({
  accountId: userId,
  amount: 10,
  idempotencyKey: "example:business-record-id",
  sourceType: "example",
  sourceId: "business-record-id",
  reason: "明确的积分变动原因",
});
// result = { entry, replayed }
// debit 接收相同参数；amount 始终传正整数。

await points.reverse({
  accountId: userId,
  entryId: result.entry.id,
  idempotencyKey: "example-reversal:business-record-id",
  sourceType: "example-reversal",
  sourceId: "business-record-id",
  reason: "明确的冲正原因",
});

await points.getBalance(userId); // { balance }
await points.listEntries(userId, {}); // { items, nextCursor }
await points.listEntries(userId, { before: cursor });

// 身份来自当前会话；每次操作还在事务内检查管理员状态。
const adminPoints = createAdminPointsService(headers);
// adminPoints 提供相同五个方法和 transaction。

// 普通用户查询不接受 accountId，只读取会话本人。
await getOwnPointsBalance(headers);
await listOwnPointsEntries(headers, {});
```

以上为接口用法，不是已接通的业务。系统服务是具备写权限的内部能力，不是面向不可信调用方的授权接口。不得从请求体选择系统身份或直接传入奖励数量；业务接入层必须先核验资格并在服务端决定数量。管理员身份不能由请求参数覆盖。

普通用户流水返回 ID、类型、数量、记账后余额、原因、冲正关联和时间；不返回系统/管理员身份、幂等标识和业务内部来源。列表固定每页 30 条，按流水 ID 倒序游标分页，不执行总数查询。

尚未提供公开 URL。流水 ID 只是内部及私有查询游标；未来若新增公开页面，应按既有公开 ID 映射规范处理。未来新增 HTTP 写路由时仍须检查来源、请求体大小和权限，私有响应不缓存。

## 幂等和冲正

幂等键在**账户范围内**唯一，调用方必须加入稳定业务命名空间，并在重试中复用。不能每次请求随机生成一个新键。相同账户、键及参数返回原流水，`replayed=true`；变动类型、数量、来源、原因、操作主体或冲正目标不同则报冲突。

返回的 `entry.balanceAfter` 是那笔流水的历史余额，重试也不改为最新余额；需要当前余额时调用 `getBalance`。不能只根据写入调用成功就再次执行非幂等业务副作用，应检查 `replayed` 并结合业务记录设计。

冲正仅支持原入账/扣减的**全额反向操作**，每笔原流水最多冲正一次，不允许再次冲正冲正记录。撤回已消费的奖励会返回余额不足，不产生负余额；余额恢复后可用同一键重试。部分退款、过期、冻结和转账均不在当前范围内。

## 与业务共用事务

```ts
await points.transaction(async ({ points: txPoints, client }) => {
  // 所有业务 SQL 必须使用这里的 client 和参数化查询。
  // 所有积分操作必须使用 txPoints；不要调用外面的 points（会另开事务）。
  const result = await txPoints.debit(input);
  if (!result.replayed) {
    await client.query(businessSql, businessParameters);
  }
});
```

回调正常返回后提交，抛错则全部回滚。单次积分写入还使用保存点；调用方捕获某次积分操作失败后，不会遗留它的余额更新或空账户。不要吞掉业务 SQL 错误后继续提交。

回调内操作必须逐个 await，不能在同一连接上并发积分调用，不能保存事务对象留到回调结束后使用。不要自行 BEGIN、COMMIT、ROLLBACK 或 release，也不要在事务中执行网络请求。多账户业务应按稳定账户顺序获得锁；数据库死锁或连接错误交给上层以同一幂等键重试整个业务事务，不自动重试任意业务回调。

## 常见错误

| 错误码 | 含义 |
| --- | --- |
| INVALID_POINTS_INPUT | 参数、金额或游标无效 |
| POINTS_ACCOUNT_NOT_FOUND | 用户不存在 |
| POINTS_ENTRY_NOT_FOUND | 原流水不存在或不属于目标账户 |
| POINTS_INSUFFICIENT | 余额不足 |
| POINTS_BALANCE_LIMIT | 余额超过安全整数上限 |
| POINTS_IDEMPOTENCY_CONFLICT | 已有幂等键对应另一组参数 |
| POINTS_ALREADY_REVERSED | 原流水已经冲正 |
| POINTS_INVALID_REVERSAL | 不允许对冲正记录再冲正 |
| POINTS_TRANSACTION_SCOPE / POINTS_TRANSACTION_PENDING | 事务对象过期或操作未依次等待 |

认证、权限和限流沿用现有 Core 错误。存储权限检查与用户管理共用权限锁，避免管理员降权与记账并发绕过检查。

## 迁移与验证

追加迁移 `028_points.sql`，不修改历史迁移。由用户执行 `pnpm db:migrate` 应用；应用新迁移前，新积分方法不可调用。

`packages/core/tests/points-cases.ts` 已接入 `pnpm test:security`，覆盖授权、参数校验、并发幂等、冲突、并发超扣、冲正、业务事务回滚、保存点、过期事务引用、分页、整数上限和账目核对。该命令按项目既有流程创建专用测试数据库，并依赖可启动的生产构建；不要直接对业务数据库运行测试文件。

交付时未执行迁移、构建、类型检查或测试。用户可执行 `pnpm typecheck`、`pnpm build` 和 `pnpm test:security`。

积分两表已加入备份清单的行数核对，旧备份仍按其实际清单校验。`pnpm db:check` 增加账户余额、逐笔余额与冲正关联检查；这是手动维护时的全量对账，不在页面请求或记账路径执行。

事务和锁依据：[node-postgres 事务说明](https://node-postgres.com/features/transactions)、[PostgreSQL 17 显式锁](https://www.postgresql.org/docs/17/explicit-locking.html)；实现沿用当前 pg 8.23.1 和 PostgreSQL 17。
