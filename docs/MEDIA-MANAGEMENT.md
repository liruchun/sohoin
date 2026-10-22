# Media management

## Implemented

勋章图标复用媒体库上传、缩略图和管理员读取接口；`badges.icon_media_id` 纳入使用中判定和删除保护，不因用于勋章而公开媒体。迁移与后台操作见 [BADGES.md](BADGES.md)。

### Responsive public images

普通栅格上传在原图与既有 480×480 内缩略图之外，按宽度生成 `w480`、`w960`、`w1440` WebP（质量 82）。仅生成比原图窄的尺寸，按比例缩小、不裁剪；SVG/Logo/图标专用上传不额外生成。原图保留为最高分辨率候选和灯箱来源。

公开列表批量带回实际存在的变体及宽度，页面使用原生 `srcset`/`sizes`。懒加载使用 `auto` 获取实际布局宽度，并附布局回退值；优先加载图片使用布局值。轮播回退宽度依据高宽比和既有高度规则，单图回退取可用宽度上界。后续布局变更须同步维护回退值。旧图片没有变体时维持原加载方式，不输出不存在的 URL。

`/api/site-media/{key}?variant=w480|w960|w1440` 只读取已生成文件，沿用公开性、封禁、索引资格检查、`private, no-store` 和有条件的 `X-Robots-Tag: noindex`。未知/重复 variant 返回 400，缺少变体返回 404；`thumbnail` 和原图保持兼容。页面语义、alt、canonical、JSON-LD、sitemap 沿用原内容及原图，不为变体生成独立索引页。

删除统一遍历媒体变体表；备份、恢复、清理的路径白名单包含新尺寸。无新增数据库迁移或依赖。

旧图片补生成（项目根目录）：

```powershell
pnpm media:responsive --limit=100
pnpm media:responsive --apply --email=你的管理员邮箱 --limit=100
```

首条预览当前批次，第二条生成并登记变体，使用现有管理员邮箱记录审计。每批最多 500 张、默认 100 张；重复执行到 `processed: 0`。已完成尺寸跳过，异常清理未提交文件；强制终止遗留的孤立文件由现有媒体清理流程回收。写入期间持有排他媒体维护锁，上传/删除会暂时报告维护中，建议低流量时运行。源文件缺失时停止并保留已完成批次，补回原图后继续。补生成后刷新并等待首页既有路由缓存过期。

本次未运行补生成、构建、测试或浏览器操作。请执行 `pnpm typecheck`、`pnpm build`、`pnpm test:security`（创建专用本地测试数据库）、`pnpm test:public-site`。新增回归覆盖实际尺寸、不放大小图、跳过已完成尺寸、删除与公开性撤销；人工检查手机/桌面、高 DPR、竖图、轮播、灯箱和旧数据兼容。生产资源测量由用户按现有脚本执行，源码完成不代表性能验收。

- Inkscape SVG imports discard editor namespace declarations/attributes and the Sodipodi `namedview` subtree before retaining the static SVG. Namespace identity, not a prefix spelling, controls this removal. Visible SVG elements, CSS and resource references still pass the existing allowlists; script, event handlers, external resources and unknown namespaces remain rejected. Uploads remain separate image resources, with existing visibility/indexing rules. Regression cases cover editor metadata removal and rejection of active content; run `pnpm test:security` locally (not executed during this change).

- `/admin/media`: server-rendered, keyset pagination of 30 ready assets, lazy 480px thumbnails, dimensions, processed bytes, reference state and delete control. Existing neutral shadcn admin styles are reused.
- Administrators upload static JPEG, PNG and WebP. Website and future APP use the same Core service and versioned HTTP contracts.
- `sharp` handles raster processing; the expressly approved server-only `@xmldom/xmldom` parses restricted SVG. It loads on upload, not in browser code. Raster signatures, declared MIME and decoded metadata must agree; invalid/truncated input is rejected. SVG is accepted only with `purpose=logo/icon`, limited to 1 MiB, parsed and checked against element/attribute/CSS allowlists. The serialized static SVG is retained and served directly for selected Logos; WebP is a separate private library thumbnail. Entities, scripts, events, animation and external resources are rejected. Restricted internal color-scheme CSS is supported. General media uploads still reject SVG; GIF, APNG/animated WebP and other formats are not enabled.
- Input: at most 10 MiB, 20 million pixels, 30 seconds to receive; at most two active uploads per Node process, no unbounded processing queue. Processing has decoder time limits. Shared PostgreSQL limits allow 20 media writes per administrator per minute. These are initial limits, not load-test results or a cross-process concurrency cap.
- Full-size stored raster image: re-encoded WebP (quality 85), auto-oriented, embedded metadata removed. The source file is not retained; its name is a display label only. Thumbnail: fit inside 480×480, without enlargement, WebP quality 75. Width/height, byte size, MIME and checksum describe processed output, never untrusted client values.
- `MEDIA_STORAGE_DIR` must be an absolute server-only path outside `public/`, set locally to `D:/project/sohoin/.local/media`. Keys contain server-generated random identifiers. No storage path or credential is returned to clients. Back up this directory with PostgreSQL; upgrading Core must preserve it.
- File reads require administrator authentication, are `private, no-store`, use `nosniff` and a restrictive CSP, and accept only fixed variant names. Nothing is served directly from Next `public/`. Private images must not be passed through a public image optimizer or CDN.
- Upload commits metadata, thumbnail and audit in one database transaction after both files are written. Transaction failure cleans up newly written files. Database writes recheck administrator permission under a user-row lock.
- Delete checks submitted version and current references under an asset lock. Referenced assets return 409. Deletion first commits a tombstone and audit, closing API access, then removes files. It never physically deletes the asset record. `cleanupPending` signals a failed physical cleanup; tombstones retain keys for operator recovery. `pnpm media:cleanup` now previews tombstone/orphan cleanup; `--apply` explicitly executes it, with at least a 24-hour grace period for orphans. No automatic schedule is enabled. See MAINTENANCE.md.
- `media_audit` retains upload/delete actions independently of asset visibility. `/admin/audit?type=media` displays these records, including deleted assets, with the same permission and 30-row cursor bounds as other audits.
- `/admin/media/{id}` displays image metadata and paginated references, including draft/archived contents and each usage role/position. References are paged by link id, using the additive 008 `(media_id,id DESC)` index; no unbounded reverse lookup or reference-count cache is used.

## HTTP / Core

Shared types/schemas: `packages/extension-api/src/media.ts`; dependency-free browser limits: `media-limits.ts`. OpenAPI includes:

- `GET /api/v1/admin/media?before=…`
- `POST /api/v1/admin/media`: raw image bytes, actual `Content-Type`, URI-encoded `X-File-Name`; not multipart. Optional `?purpose=logo/icon` accepts restricted `image/svg+xml` and retains its vector form. Icon uploads precompute five PNG variants.
- `GET /api/v1/admin/media/{id}/file`, optional fixed variants `thumbnail`, `logo`, `favicon`, `apple`, `app-192`, `app-512`, `maskable-512`
- `DELETE /api/v1/admin/media/{id}`: JSON `{version}`.
- `GET /api/v1/admin/media/{id}?before=…`: metadata plus at most 30 reference entries.
- `GET /api/v1/admin/audit/media?before=…`: upload/deletion audit page.

Cookie writes require matching Origin; cookie-free APP clients use a Bearer session token. Origin, authentication, body bounds, permission, processing and database constraints apply independently. Core `uploadMedia` takes a lazy reader so authentication/rate/concurrency checks happen before receiving image data.

## Deferred

Content editors can select one cover, up to ten gallery images and ten image attachments, and edit alternative text, captions and order per usage. The library opens lazily with 30 candidates per page; no eager library request or new client dependency is introduced. Source names and image attributes remain immutable media properties. The same image can be reused across roles/contents; duplicate use within one role is rejected.

`media` is optional on content writes: omission preserves existing links for older clients; `[]` explicitly removes them; a nonempty array replaces them, with positions derived from array order inside each role. Content, links, schema data, content version and audit share a transaction. Selected media ids lock in numeric order and must be ready images before binding. Deletion uses the same row lock and rechecks references after acquisition, so a concurrent bind/delete cannot leave tombstone references. Invalid media rolls back the entire content update. Content deletion removes links but keeps reusable assets.

Public delivery is not wired yet. Public detail/list contracts omit media and administrator preview still renders only the saved text template. Public serving must later resolve published-content references and close access on unpublishing; administrator URLs must never be exposed as public cover URLs.

Video/audio/documents, animated images, original-file preservation, image editing, S3-compatible storage, remote URL imports, scheduled garbage collection and disk quotas remain separate work. Manual cleanup/backup/restore tools are available in MAINTENANCE.md. Local storage fits this single-server phase; multi-server deployment requires shared/object storage and a deployment-wide processing limit. Production proxies should also bound upload bytes, receive time and concurrency.

## Verification

`pnpm test:security` provisions a temporary PostgreSQL database and a separate media directory, both removed afterward. Coverage includes authentication/Origin, signature spoofing, corrupt input, streamed/declared byte bounds, re-encoding/metadata removal, private variants, stale versions, reference protection, physical cleanup, audits and bounded pagination. It does not measure production throughput.

## Site icons and vector Logos

`POST /api/v1/admin/site-icons/generate` accepts strict JSON `{mediaId}` (1024-byte body bound), checks administrator access and clones the source into a generated icon asset. It reuses upload write limits, bounded processing and transactional metadata/audit. Save settings separately to publish. `/api/v1/site-icon/{variant}` only resolves current favicon/App bindings; arbitrary media IDs stay private. SVG Logos use the original validated vector; public raster Logos retain existing thumbnail delivery.

Generated variants are 32px transparent favicon, opaque white 180/192/512px App images with 10% padding and 512px maskable with 20% padding. Storage, backup and cleanup recognize `.svg` and fixed icon suffixes. Settings reference checks include icons for listing and deletion protection. This task has not run automated validation; the user runs typecheck/build/security tests and production page measurements.
