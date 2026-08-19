import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Vite allowed hosts", () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    process.env.KONDIS_VITE_ALLOWED_HOSTS = "allowed.example.com";

    server = await createServer({
      configFile: "./vite.config.ts",
      server: {
        host: "127.0.0.1",
        port: 0,
      },
    });
    await server.listen();
  });

  afterAll(async () => {
    await server.close();
    delete process.env.KONDIS_VITE_ALLOWED_HOSTS;
  });

  const request = (host: string) =>
    fetch(`http://127.0.0.1:${server.config.server.port}/`, {
      headers: { Host: host },
    });

  it("allows a configured hostname", async () => {
    const response = await request("allowed.example.com");

    expect(response.status).not.toBe(403);
  });

  it("blocks a hostname that is not configured", async () => {
    const response = await request("untrusted.example.com");

    expect(response.status).toBe(403);
  });
});
