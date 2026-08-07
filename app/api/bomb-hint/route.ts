import { handleBombHintProxyRequest } from "@/lib/server/oci-bomb-hint-client";
import { loadOciProxyConfig } from "@/lib/server/oci-plan-client";

export const runtime = "nodejs";

const proxyConfig = loadOciProxyConfig();

export async function POST(request: Request) {
  return handleBombHintProxyRequest(request, { config: proxyConfig });
}
