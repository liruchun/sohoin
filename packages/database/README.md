# PostgreSQL 数据层

使用 pg 驱动与参数化 SQL。数据库连接池、设置存储、审计写入和共享限流计数器仅在服务端可用，由 server-only 阻止客户端导入。

迁移位于 migrations/，通过根目录 pnpm db:migrate 执行。schema_migrations 记录文件校验和，已应用文件不可修改；升级需新增 SQL 文件。执行过程使用 PostgreSQL advisory lock 串行化，并逐文件事务提交。

001 为站点设置、审计与原子限流计数表；002 为根据锁定的 Better Auth 1.7.9 配置生成并审阅的认证表。不要在生产环境自动生成或隐式执行迁移。

本地独立实例用 pnpm db:local 启动，数据保存在根目录 .local/postgres17，绑定 127.0.0.1:55432。embedded-postgres 仅为开发工具，运行的引擎为真实 PostgreSQL 17；部署时改为自建 PostgreSQL 或 compose.yaml，不依赖此开发启动器。
