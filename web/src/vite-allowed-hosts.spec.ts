import {
  createServer as createHttpServer,
  request as httpRequest,
} from "node:http";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const findAvailablePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createHttpServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine an available port"));
        return;
      }

      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

describe("Vite allowed hosts", () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    process.env.KONDIS_VITE_ALLOWED_HOSTS = "allowed.example.com";
    process.env.KONDIS_API_URL = "http://api.example.test:2293";
    const port = await findAvailablePort();

    server = await createServer({
      configFile: "./vite.config.ts",
      server: {
        host: "127.0.0.1",
        port,
        strictPort: true,
      },
    });
    await server.listen();
  });

  afterAll(async () => {
    await server.close();
    delete process.env.KONDIS_VITE_ALLOWED_HOSTS;
    delete process.env.KONDIS_API_URL;
  });

  const request = (host: string) =>
    new Promise<number>((resolve, reject) => {
      const request = httpRequest({
        host: "127.0.0.1",
        port: server.config.server.port,
        path: "/@vite/client",
        headers: { Host: host },
      });
      request.once("error", reject);
      request.once("response", (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      request.end();
    });

  it("allows a configured hostname", async () => {
    const status = await request("allowed.example.com");

    expect(status).toBe(200);
  });

  it("blocks a hostname that is not configured", async () => {
    const status = await request("untrusted.example.com");

    expect(status).toBe(403);
  });

  it("proxies activity event WebSockets to the API", () => {
    const eventsProxy = server.config.server.proxy?.["/events"];

    expect(eventsProxy).toMatchObject({
      target: "http://api.example.test:2293",
      changeOrigin: true,
      ws: true,
    });
    expect(server.config.server.proxy?.["/api/v1/events"]).toBe(eventsProxy);
  });
});
