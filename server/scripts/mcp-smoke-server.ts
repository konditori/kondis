// Disposable manual test server. Uses the image built by the medium-test suite.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeApiApp, createNodeServer } from 'src/api/node';
import { createApplicationComposition } from 'src/composition.node';
import { UserRole } from 'src/enum';
import { createMcpApp } from 'src/mcp/app';
import { SCOPES } from 'src/mcp/context';
import { ConfigRepository } from 'src/repositories/config.repository';
import { migrateDatabase } from 'src/repositories/database.repository';
import { ApiKeyService } from 'src/services/api-key.service';
import { ManualActivitySchema, OperationService } from 'src/services/operation.service';
import { GenericContainer, Wait } from 'testcontainers';

async function main() {
  const container = await new GenericContainer('kondis-medium-postgres:latest')
    .withEnvironment({ POSTGRES_PASSWORD: 'postgres', POSTGRES_USER: 'postgres', POSTGRES_DB: 'mcp_smoke' })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .start();
  const directory = await mkdtemp(join(tmpdir(), 'kondis-mcp-smoke-'));
  const config = new ConfigRepository({
    KONDIS_DB_HOSTNAME: container.getHost(),
    KONDIS_DB_PORT: String(container.getMappedPort(5432)),
    KONDIS_DB_USERNAME: 'postgres',
    KONDIS_DB_PASSWORD: 'postgres',
    KONDIS_DB_DATABASE_NAME: 'mcp_smoke',
    KONDIS_STORAGE_DIR: directory,
    KONDIS_PORT: '2294',
    KONDIS_MCP_PUBLIC_URL: 'http://localhost:5174/mcp',
  });
  await migrateDatabase(config.database);
  const application = createApplicationComposition({ role: 'worker', configRepository: config });
  await application.initialize();
  const user = await application.authService.create(
    'mcp-smoke@example.test',
    'MCP',
    'Tester',
    'mcp-smoke-password',
    UserRole.User,
  );
  const key = await new ApiKeyService(application.database).create(user.id, {
    name: 'Smoke client',
    scopes: [...SCOPES],
    expiresInDays: 1,
  });
  const session = await application.authCredentialRepository.createSession(user.id);
  const operations = new OperationService(
    application.database,
    application.queueAdapter,
    application.storageRepository,
  );
  await operations.create(
    { userId: user.id, credentialId: key.id, scopes: new Set(SCOPES) },
    ManualActivitySchema.parse({
      name: 'Smoke test morning run',
      sport: 'run',
      startedAt: '2026-09-14T08:00:00Z',
      elapsedTime: 1800,
      distance: 5000,
      idempotencyKey: 'seed',
    }),
  );
  const app = createMcpApp({
    database: application.database,
    sessions: application.authCredentialRepository,
    jobs: application.queueAdapter,
    storage: application.storageRepository,
    publicUrl: config.mcpPublicUrl,
    trustProxyHeaders: true,
    mutationsEnabled: true,
  });
  const server = createNodeServer(createNodeApiApp(application), app);
  await new Promise<void>((resolve) => server.listen(2294, '127.0.0.1', resolve));
  const credentialsPath = join(directory, 'credentials.json');
  await writeFile(credentialsPath, JSON.stringify({ key: key.secret, session, endpoint: config.mcpPublicUrl }), {
    mode: 0o600,
  });
  console.log(`Smoke server ready on 2294; temporary credentials: ${credentialsPath}`);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await application.close();
    await container.stop();
    await rm(directory, { recursive: true, force: true });
  };
  process.once('SIGTERM', () => {
    void close();
  });
  process.once('SIGINT', () => {
    void close();
  });
}
void main();
