import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbScript = path.join(root, "scripts", "local-postgres.mjs");
const webDir = path.join(root, "apps", "web");
const webHost = "127.0.0.1";
const webPort = "3194";

function webPackageName() {
  try {
    return JSON.parse(readFileSync(path.join(webDir, "package.json"), "utf8")).name;
  } catch {
    return "@sohoin/web";
  }
}

export function databaseTarget(value = process.env.DATABASE_URL) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
    return { host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 5432) };
  } catch {
    return null;
  }
}

export function isLoopbackHost(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function probePort(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort(host, port, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePort(host, port)) return true;
    if (child && child.exitCode !== null) return false;
    await delay(250);
  }
  return false;
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

function pnpmInvocation(args) {
  const entry = process.env.npm_execpath;
  if (entry && /pnpm/i.test(path.basename(entry)) && /\.(?:c?js|mjs)$/i.test(entry)) {
    return { command: process.execPath, args: [entry, ...args] };
  }
  if (process.platform === "win32") {
    const quote = (value) => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", `pnpm ${args.map(quote).join(" ")}`],
    };
  }
  return { command: "pnpm", args };
}

async function main() {
  const target = databaseTarget();
  const packageName = webPackageName();
  let dbChild = null;
  let nextChild = null;
  let stopping = false;
  let shutdownPromise = null;

  const shutdown = (code) => {
    if (!shutdownPromise) shutdownPromise = stop(code);
    return shutdownPromise;
  };

  async function stop(code) {
    if (stopping) return;
    stopping = true;
    if (dbChild && dbChild.exitCode === null) {
      console.log("[dev] 正在停止本次启动的数据库…");
      try {
        dbChild.send("stop");
      } catch {}
      if (!(await waitForExit(dbChild, 8000)) && dbChild.exitCode === null) {
        try {
          dbChild.kill("SIGKILL");
        } catch {}
      }
    }
    if (nextChild && nextChild.exitCode === null) {
      try {
        nextChild.kill("SIGTERM");
      } catch {}
    }
    process.exit(code);
  }

  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  if (!target) {
    console.warn("[dev] 未读取到 DATABASE_URL，跳过数据库检查");
  } else if (!isLoopbackHost(target.host)) {
    console.log(`[dev] 数据库配置为 ${target.host}:${target.port}，跳过本地数据库启动`);
  } else {
    const host =
      target.host === "localhost" || target.host === "::1" ? "127.0.0.1" : target.host;
    if (await probePort(host, target.port)) {
      console.log(`[dev] 数据库已在运行：${host}:${target.port}`);
    } else {
      console.log("[dev] 数据库未运行，正在从 .local/postgres17 启动…");
      dbChild = spawn(process.execPath, [dbScript], {
        cwd: root,
        env: process.env,
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      });
      dbChild.on("error", (error) => console.error(`[dev] 数据库进程启动失败：${error.message}`));
      if (!(await waitForPort(host, target.port, 60000, dbChild))) {
        console.error("[dev] 数据库在 60 秒内未就绪，已中止启动。");
        await shutdown(1);
        return;
      }
      console.log(`[dev] 数据库已就绪：${host}:${target.port}`);
    }
  }

  const invocation = pnpmInvocation([
    "--filter",
    packageName,
    "dev",
    "--port",
    webPort,
    "--hostname",
    webHost,
  ]);
  nextChild = spawn(invocation.command, invocation.args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  nextChild.on("error", (error) => {
    console.error(`[dev] 无法启动 Next.js：${error.message}`);
    void shutdown(1);
  });
  nextChild.on("exit", (code, signal) => {
    void shutdown(code ?? (signal ? 1 : 0));
  });
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
