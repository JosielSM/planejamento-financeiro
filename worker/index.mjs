import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";

globalThis.__CLOUDFLARE_ENV__ = env;

let apiHandlerPromise;

function getApiHandler() {
  apiHandlerPromise ||= import("../src/server.mjs")
    .then(({ app }) => httpServerHandler(createServer(app)));
  return apiHandlerPromise;
}

export default {
  async fetch(request, workerEnv, context) {
    const url = new URL(request.url);

    if (url.pathname === "/download/android") {
      const apkUrl = new URL("/downloads/planejamento-financeiro.apk", request.url);
      const assetResponse = await workerEnv.ASSETS.fetch(new Request(apkUrl, request));
      if (!assetResponse.ok) return assetResponse;

      const headers = new Headers(assetResponse.headers);
      headers.set("Content-Type", "application/vnd.android.package-archive");
      headers.set("Content-Disposition", 'attachment; filename="Planejamento-Financeiro.apk"');
      return new Response(assetResponse.body, { status: assetResponse.status, headers });
    }

    if (url.pathname.startsWith("/api/")) {
      const apiHandler = await getApiHandler();
      return apiHandler.fetch(request, workerEnv, context);
    }

    return workerEnv.ASSETS.fetch(request);
  },
};
