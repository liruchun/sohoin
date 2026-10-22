# 内容社区数据库基础

本阶段采用 PostgreSQL 17、明确公共列、独立媒体关系、受约束的类型扩展。没有 EAV 风格的通用 post_meta 表，没有引入 ORM、缓存服务或队列依赖。006 为追加迁移，001–005 不修改。

## 当前表关系

积分基础表为 `points_accounts`（用户余额）和 `points_entries`（追加式流水与操作审计），由追加迁移 `028_points.sql` 创建。接口、事务和权限边界见 [POINTS.md](POINTS.md)；目前不接触发规则或消费场景。

勋章基础表为 `badges`（定义）、`user_badges`（当前授予状态）和 `badge_audit`（追加式审计），由 `029_badges.sql` 创建；接口与启停、幂等、撤销语义见 [BADGES.md](BADGES.md)。勋章与积分独立，尚未接入自动规则或页面。

| 表 | 角色 |
| --- | --- |
| contents | 内容公共字段、类型、作者、发布状态、乐观版本、时间与短预览 |
| content_categories | 平级主分类，一个内容最多一个分类，发布须选择；含说明与可选图标媒体 |
| content_category_members | 用户加入分类的多对多关系，与用户关注用户分离 |
| content_tags / content_tag_links | 标签及内容的多对多关联 |
| content_extensions | 内容一对一扩展，schema_version 与有界 JSONB |
| media_assets | 原始文件定位、元数据和处理状态 |
| media_variants | 每个派生文件独立的定位、格式、体积与尺寸 |
| content_media | 内容使用媒体的角色、顺序、alt 和说明 |
| content_audit | 成功操作的精简记录，不保存完整正文或扩展字段 |

现有认证、设置、用户权限审计、账号安全记录继续独立存放。评论、互动和审核规则尚未实现，不先建无实际业务约束的空表。

## 文章与帖子

内置 article 和 post。所有非 post 类型要求非空标题；post 标题允许为空，但正文必须非空，包括草稿。发布仍要求分类和正文。保持 title 非 NULL，避免旧读取代码出现 NULL 分支；可选标题用空字符串表达。

feed_text 是有界的数据库生成列：无摘要的帖子使用前 280 个 PostgreSQL 字符，其他情况使用摘要。保存时计算、读取时直接取，不在列表里读取完整正文或扩展 JSON。详情及编辑始终读取原始 excerpt/body，避免把自动预览回写成手填摘要。生成列是以少量派生存储换列表读取成本，仍应在真实数据规模下评估存储与查询计划。

后台标题必填随类型切换，已有扩展数据更换类型时明确确认，保存前仅改变本地编辑状态。信息流、详情和删除确认对无标题帖子提供可读的备用文字；数据库不强行生成或存储一个虚假标题。

## 分类图标与成员

`content_categories.description` 是已有列，上限 300 字符；`icon_media_id` 只引用 `media_assets` 中 `status='ready'`、`kind='image'`、`mime_type='image/webp'` 的图片，删除被引用的媒体会被阻止。公开读取只把有 `thumbnail` 变体的图标暴露为 `/api/site-media/...?variant=thumbnail`；没有图标时前台回退到通用图标。

`content_category_members` 以 `(category_id,user_id)` 为主键，`created_at` 记录加入时间；用户索引支持“我的分类”和用户删除级联，主键前缀支持分类成员判断与按需计数。加入/退出是幂等单条写入，不需要额外的角色或软删除。分类页默认只返回 `joined` 状态，不维护冗余人数；列表展示人数前先评估聚合成本或另加事务计数。

## 类型扩展与权限

content_extensions 的 content_id 同时为主键和外键。一篇内容最多一行，不为每个键建立一行，不默认建立整块 JSON 的 GIN 索引。需要频繁筛选、排序、唯一约束的字段，应迁移为明确列或专属表。

Custom 在 ContentTypeDefinition 中注册 extension：

```ts
{
  id: "resource-note",
  label: "资源笔记",
  extension: {
    schemaVersion: 1,
    fields: {
      summary: {kind: "text", maxLength: 120, required: true, public: true},
      staffNote: {kind: "text", maxLength: 200},
      score: {kind: "number", min: 0, max: 100, integer: true},
      layout: {kind: "enum", options: ["normal", "compact"], public: true}
    }
  }
}
```

首版支持扁平的文本、有限数值、布尔、枚举；最多 20 个字段，写入数据 JSON UTF-8 最多 8 KiB，数据库 JSONB 文本大小另设 16 KiB 保护。保留空间用于 JSONB 格式化开销。字段名有长度及字符限制，拒绝危险原型属性。required 表示字段必须存在；各字段按声明验证值。默认不公开，只有 public:true 才进入公开详情和正文模板。

输入通过 ContentValue.data 提交，不能提交 schemaVersion 指定服务端版本。注册扩展类型的更新必须显式传完整 data，防止旧客户端遗漏字段后清空数据。普通编辑器会保留服务器返回的 data，不自动生成字段表单；专属字段的编辑 UI 尚未接入。

扩展写入与正文、标签、内容版本、审计同事务。内容行锁及 version 控制并发；扩展表不另起一套独立版本流程。相同类型已存 Schema 版本与当前声明不一致时，拒绝覆盖，必须先迁移数据；公开读取在 Schema 版本不匹配时隐藏扩展字段。撤销注册也不自动公开或清空存量数据。

列表不 JOIN 扩展表，不返回 data。详情通过主键关联读取；后台详情有完整 data 与 dataSchemaVersion，公开详情和管理员预览只给正文模板经过筛选的公共字段。未知或撤销的类型使用默认模板并隐藏扩展数据。

## 媒体元数据

media_assets 包含 uploader_id、storage_provider、storage_namespace、storage_key、original_name、kind、mime_type、byte_size、width、height、duration_ms、checksum_sha256、status 与时间。文件、URL 签名、存储密钥均不写入这张表。对象键与存储命名空间代替固定 CDN URL，便于以后迁移存储。

宽高必须同时为空或同时为正数。ready 状态必须有正文件体积，图片和视频还必须有完整尺寸；pending 允许处理前元数据为空。duration 可为空，sha256 可为空且不建立全局去重唯一约束。元数据将由后续可信上传流程检测，不接受客户端自报即视为可用。

原始媒体可用状态和派生文件状态独立。media_variants 每个 variant_key 对同一原件唯一，例如 thumb-webp-320；每个实际输出文件保存自己的 MIME、体积、宽高及对象键。原件与派生文件应采用不同对象键命名规则，避免跨表文件覆盖；此规则由未来存储适配器执行，不依赖两张表各自的唯一约束。

media_assets 按上传者及 id 建分页索引；待上传、失败、已删除状态有清理候选索引。派生文件通过 media_id/variant_key 唯一索引读取，不给所有元数据列增加索引。

## 内容引用与生命周期

content_media 每处使用有独立 id、content_id、media_id、role、position、alt_text、caption。role 首版限定 cover/gallery/attachment。同一内容同角色位置唯一，封面只能一个且位置为 0；同一原件可被不同内容或不同用途复用。按内容的排序读取使用复合唯一索引，按媒体检查引用使用反向索引。

删除内容级联删除关联和扩展，不删除原始媒体。仍被引用的原件不能物理删除；原件物理删除时派生文件记录级联删除，但文件本身不由 SQL 删除。没有冗余引用计数列，真正清理前依据关联检查。

上传者删除时媒体 uploader_id 置空，保留历史资源。后续资源访问必须结合内容可见状态、引用、拥有者和管理员权限；status=ready 仅表示处理状态，不表示公开。不得因为知道 storage_key 或 media id 就允许访问草稿图片。

007 已接入管理员图片上传、私有文件读取、缩略图和软删除，并增加 version、ready 列表索引和独立 media_audit。源文件不保留，media_assets 指向重新编码后的全尺寸 WebP。008 增加 `(media_id,id DESC)` 引用分页索引，后台已接入内容媒体绑定、使用明细和媒体审计。详情见 [MEDIA-MANAGEMENT.md](MEDIA-MANAGEMENT.md)。公开投递和定时清理仍未接入；正文继续纯文本。

## 验证与后续优化

009 已补作者外键、主要字段长度/格式及版本等 CHECK 约束；审计历史标识继续保留。数据库检查、媒体清理、数据库与媒体一致性备份、只恢复到新目标的工具见 [MAINTENANCE.md](MAINTENANCE.md)。这些是手动命令，未配置定时任务或异地备份。

010 基于模拟数据验证增加管理员、禁用用户分页部分索引。媒体引用状态改为每页有界索引探测，避免 hashed EXISTS 扫描整个关联表。执行计划及测量范围见 [ADMIN-ACCEPTANCE.md](ADMIN-ACCEPTANCE.md)。

在专用临时库验证：标题规则、短预览与原正文分离、扩展字段校验/脱敏、Schema 变更冲突、并发更新、媒体尺寸、封面唯一性、引用删除保护和级联清理。构建和类型检查外，还通过生产页面测量确认首页不包含后台代码。

这不是规模压测结论。扩大数据量后，应按真实列表、标签筛选、详情和发布比例检查 EXPLAIN (ANALYZE, BUFFERS)、接口耗时、响应体积及写入成本，再决定是否增加复合索引、统计表或缓存。当前不提前分库、分区或增加外部基础设施。
