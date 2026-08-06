import type { PlanResult } from "../schemas/rescue-plan.js";

type CacheEntry = { value: PlanResult; expiresAt: number };

export class PlanCache {
  private readonly entries = new Map<string, CacheEntry>();
  constructor(private readonly ttlMs: number, private readonly maxEntries: number) {}

  static key(command: string): string { return command.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR"); }

  get(command: string, now = Date.now()): PlanResult | undefined {
    const key = PlanCache.key(command); const entry = this.entries.get(key);
    if (!entry || now >= entry.expiresAt) { this.entries.delete(key); return undefined; }
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.value;
  }

  set(command: string, value: PlanResult, now = Date.now()) {
    if (value.source !== "openai") return;
    const key = PlanCache.key(command);
    this.entries.delete(key); this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value as string);
  }
}
