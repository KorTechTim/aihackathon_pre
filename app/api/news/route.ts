import { handleNewsProxyRequest } from "@/lib/server/oci-news-client";
import { loadOciProxyConfig } from "@/lib/server/oci-plan-client";

export const runtime = "nodejs";

const proxyConfig = loadOciProxyConfig();

export async function POST(request: Request) {
  return handleNewsProxyRequest(request, { config: proxyConfig });
}
