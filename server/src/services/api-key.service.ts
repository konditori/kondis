import type { TransactionRepository } from 'src/contracts/transaction.repository';
import { BadRequestException } from 'src/errors';
import { hash, ScopeSchema, token, type Principal, type Scope } from 'src/mcp/context';
import type { McpCredentialRepository } from 'src/repositories/mcp-credential.repository';
import { z } from 'zod';

export const CreateKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(ScopeSchema).min(1).max(5),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});

export class ApiKeyService {
  constructor(
    private readonly credentials: McpCredentialRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async create(userId: string, input: z.infer<typeof CreateKeySchema>) {
    const parsed = CreateKeySchema.parse(input);
    const secret = `kondis_${token()}`;
    const digest = await hash(secret);
    const expiresAt = new Date(Date.now() + parsed.expiresInDays * 86_400_000);
    return this.transactions.withTransaction(async (transaction) => {
      await this.credentials.lockOwner(userId, transaction);
      if ((await this.credentials.countActive(userId, transaction)) >= 30) {
        throw new BadRequestException('Revoke an existing connection before creating another');
      }
      const result = await this.credentials.createKey(
        { userId, name: parsed.name, tokenHash: digest, scopes: [...new Set(parsed.scopes)], expiresAt },
        transaction,
      );
      return { id: result.id, secret, expiresAt: expiresAt.toISOString() };
    });
  }

  async list(userId: string) {
    const credentials = await this.credentials.list(userId);
    return credentials.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      scopes: row.scopes,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    }));
  }

  async revoke(userId: string, id: string) {
    await this.credentials.revoke(userId, id);
  }

  async authenticate(secret: string, audience: string): Promise<Principal | undefined> {
    if (!/^kondis_[a-f0-9]{64}$/.test(secret)) {
      return;
    }
    const digest = await hash(secret);
    const row = await this.credentials.authenticate(digest, audience);
    return row && { userId: row.user_id, credentialId: row.id, scopes: new Set(row.scopes as Scope[]) };
  }
}
