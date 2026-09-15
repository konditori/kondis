import { sql } from 'kysely';
import { BadRequestException } from 'src/errors';
import { hash, ScopeSchema, token, type Scope } from 'src/mcp/context';
import type { KondisDatabase } from 'src/types';
import { z } from 'zod';

const redirectSchema = z
  .string()
  .url()
  .max(2000)
  .refine((value) => {
    const url = new URL(value);
    return (
      !url.hash &&
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)))
    );
  }, 'Redirects must use HTTPS or loopback HTTP');
export const AuthorizationSchema = z.object({
  client_id: z.string().max(200),
  redirect_uri: redirectSchema,
  response_type: z.literal('code'),
  code_challenge_method: z.literal('S256'),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  resource: z.string().url(),
  scope: z.string().max(300).default('activities:read'),
  state: z.string().min(1).max(1000),
});
export const RegistrationSchema = z.object({
  client_name: z.string().trim().min(1).max(80),
  redirect_uris: z.array(redirectSchema).min(1).max(10),
  token_endpoint_auth_method: z.literal('none').default('none'),
  grant_types: z
    .array(z.enum(['authorization_code', 'refresh_token']))
    .default(['authorization_code', 'refresh_token']),
  response_types: z.array(z.literal('code')).default(['code']),
});

export class McpOAuthService {
  constructor(
    private readonly db: KondisDatabase,
    readonly publicUrl: string,
  ) {}

  async register(input: z.infer<typeof RegistrationSchema>) {
    const v = RegistrationSchema.parse(input);
    const id = crypto.randomUUID();
    await sql`INSERT INTO mcp_oauth_client(id, name, redirect_uris) VALUES (${id}, ${v.client_name}, ${v.redirect_uris})`.execute(
      this.db,
    );
    return { client_id: id, ...v };
  }

  async validate(input: z.infer<typeof AuthorizationSchema>) {
    const v = AuthorizationSchema.parse(input);
    if (v.resource !== this.publicUrl) {
      throw new BadRequestException('Invalid resource');
    }
    const scopes = z.array(ScopeSchema).min(1).max(5).parse(v.scope.split(' '));
    const { rows } = await sql<{
      name: string;
      redirect_uris: string[];
    }>`SELECT name, redirect_uris FROM mcp_oauth_client WHERE id = ${v.client_id}`.execute(this.db);
    if (!rows[0]?.redirect_uris.includes(v.redirect_uri)) {
      throw new BadRequestException('Unregistered client or redirect URI');
    }
    return { request: v, clientName: rows[0].name, scopes };
  }

  async authorize(userId: string, input: z.infer<typeof AuthorizationSchema>, allowed: boolean) {
    const { request: v, scopes } = await this.validate(input);
    const url = new URL(v.redirect_uri);
    url.searchParams.set('state', v.state);
    url.searchParams.set('iss', new URL(this.publicUrl).origin);
    if (!allowed) {
      url.searchParams.set('error', 'access_denied');
      return url.href;
    }
    const code = token();
    await sql`INSERT INTO mcp_oauth_code(hash, user_id, client_id, redirect_uri, challenge, audience, scopes, expires_at) VALUES (${await hash(code)}, ${userId}, ${v.client_id}, ${v.redirect_uri}, ${v.code_challenge}, ${this.publicUrl}, ${scopes}, ${new Date(Date.now() + 300_000)})`.execute(
      this.db,
    );
    url.searchParams.set('code', code);
    return url.href;
  }

  async exchange(form: Record<string, string>) {
    const v = z
      .object({
        grant_type: z.enum(['authorization_code', 'refresh_token']),
        client_id: z.string().max(200),
        resource: z.literal(this.publicUrl),
        code: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        redirect_uri: redirectSchema.optional(),
        code_verifier: z
          .string()
          .regex(/^[A-Za-z0-9._~-]{43,128}$/)
          .optional(),
        refresh_token: z
          .string()
          .regex(/^kondis_refresh_[a-f0-9]{64}$/)
          .optional(),
      })
      .parse(form);
    const accessToken = `kondis_${token()}`;
    const refreshToken = `kondis_refresh_${token()}`;
    const accessHash = await hash(accessToken);
    const refreshHash = await hash(refreshToken);
    const expiresAt = new Date(Date.now() + 3_600_000);
    const scopes = await this.db.transaction().execute(async (trx) => {
      if (v.grant_type === 'refresh_token') {
        if (!v.refresh_token) {
          throw new BadRequestException('invalid_grant');
        }
        const result = await sql<{
          scopes: Scope[];
        }>`UPDATE mcp_credential SET token_hash = ${accessHash}, refresh_hash = ${refreshHash}, expires_at = ${expiresAt} WHERE refresh_hash = ${await hash(v.refresh_token)} AND client_id = ${v.client_id} AND audience = ${this.publicUrl} AND revoked_at IS NULL AND refresh_expires_at > now() RETURNING scopes`.execute(
          trx,
        );
        if (!result.rows[0]) {
          throw new BadRequestException('invalid_grant');
        }
        return result.rows[0].scopes;
      }
      if (!v.code || !v.code_verifier || !v.redirect_uri) {
        throw new BadRequestException('invalid_grant');
      }
      const challengeBytes = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v.code_verifier)),
      );
      const challenge = btoa(String.fromCodePoint(...challengeBytes))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
      const result = await sql<{
        user_id: string;
        scopes: Scope[];
      }>`DELETE FROM mcp_oauth_code WHERE hash = ${await hash(v.code)} AND client_id = ${v.client_id} AND redirect_uri = ${v.redirect_uri} AND challenge = ${challenge} AND audience = ${this.publicUrl} AND expires_at > now() RETURNING user_id, scopes`.execute(
        trx,
      );
      const code = result.rows[0];
      if (!code) {
        throw new BadRequestException('invalid_grant');
      }
      await sql`INSERT INTO mcp_credential(user_id, name, kind, token_hash, refresh_hash, client_id, audience, scopes, expires_at, refresh_expires_at) SELECT ${code.user_id}, name, 'oauth', ${accessHash}, ${refreshHash}, id, ${this.publicUrl}, ${code.scopes}, ${expiresAt}, ${new Date(Date.now() + 30 * 86_400_000)} FROM mcp_oauth_client WHERE id = ${v.client_id}`.execute(
        trx,
      );
      return code.scopes;
    });
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: scopes.join(' '),
    };
  }

  async revoke(secret: string, clientId: string) {
    const digest = await hash(secret);
    await sql`UPDATE mcp_credential SET revoked_at = now(), refresh_hash = NULL WHERE client_id = ${clientId} AND (token_hash = ${digest} OR refresh_hash = ${digest})`.execute(
      this.db,
    );
  }
}
