import { handleDialogueProxyRequest } from "@/lib/server/oci-dialogue-client";
import { loadOciProxyConfig } from "@/lib/server/oci-plan-client";

export const runtime = "nodejs";

const proxyConfig = loadOciProxyConfig();

export async function POST(request: Request) {
  return handleDialogueProxyRequest(request, { config: proxyConfig });
}
