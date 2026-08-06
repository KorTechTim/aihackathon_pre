import { handlePlanProxyRequest, loadOciProxyConfig } from "@/lib/server/oci-plan-client";

export const runtime = "nodejs";

const proxyConfig = loadOciProxyConfig();

export async function POST(request: Request) {
  return handlePlanProxyRequest(request, { config: proxyConfig });
}
