export type AppConfig = {
  host: string;
  port: number;
  nodeEnv: string;
  openaiApiKey?: string;
  openaiModel: string;
  openaiTimeoutMs: number;
  allowedOrigins: string[];
  trustProxyHops: number | false;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  rateLimitBurst: number;
  planCacheTtlMs: number;
  planCacheMax: number;
};

function positiveInt(value: string | undefined, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "https://pixel-panic-ai-rescue.vercel.app,http://localhost:3000")
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  if (nodeEnv === "production" && allowedOrigins.includes("*")) throw new Error("Wildcard CORS origin is forbidden in production");

  const trustProxyHops = env.TRUST_PROXY_HOPS ? positiveInt(env.TRUST_PROXY_HOPS, 1, 4) : false;
  return {
    host: env.HOST ?? "0.0.0.0",
    port: positiveInt(env.PORT, 8080, 65_535),
    nodeEnv,
    openaiApiKey: env.OPENAI_API_KEY?.trim() || undefined,
    openaiModel: env.OPENAI_MODEL?.trim() || "gpt-5.6-luna",
    openaiTimeoutMs: positiveInt(env.OPENAI_TIMEOUT_MS, 6_000, 6_000),
    allowedOrigins,
    trustProxyHops,
    rateLimitMax: positiveInt(env.RATE_LIMIT_MAX, 10, 1_000),
    rateLimitWindowMs: positiveInt(env.RATE_LIMIT_WINDOW_MS, 60_000, 3_600_000),
    rateLimitBurst: positiveInt(env.RATE_LIMIT_BURST, 3, 100),
    planCacheTtlMs: positiveInt(env.PLAN_CACHE_TTL_MS, 60_000, 3_600_000),
    planCacheMax: positiveInt(env.PLAN_CACHE_MAX, 100, 10_000),
  };
}
