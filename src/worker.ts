interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    if (response.status === 404) {
      const lastSegment = url.pathname.split("/").pop() || "";
      const isFileRequest = lastSegment.includes(".");

      if (!isFileRequest) {
        return env.ASSETS.fetch(
          new Request(`${url.origin}/index.html`, request),
        );
      }
    }

    return response;
  },
};
