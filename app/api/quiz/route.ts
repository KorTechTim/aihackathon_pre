import { handleQuizProxyRequest } from "@/lib/server/oci-quiz-client";
import { loadOciProxyConfig } from "@/lib/server/oci-plan-client";

export const runtime = "nodejs";

const proxyConfig = loadOciProxyConfig();

export async function POST(request: Request) {
  return handleQuizProxyRequest(request, { config: proxyConfig });
}
