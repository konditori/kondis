import type { TransactionRepository } from 'src/contracts/transaction.repository';
import { BadRequestException } from 'src/errors';
import { hash, ScopeSchema, token, type Scope } from 'src/mcp/context';
import type { McpCredentialRepository } from 'src/repositories/mcp-credential.repository';
import type { McpOAuthRepository } from 'src/repositories/mcp-oauth.repository';
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
    private readonly oauth: McpOAuthRepository,
    private readonly credentials: McpCredentialRepository,
    private readonly transactions: TransactionRepository,
    readonly publicUrl: string,
  ) {}

  async register(input: z.infer<typeof RegistrationSchema>) {
    const v = RegistrationSchema.parse(input);
    const id = crypto.randomUUID();
    await this.oauth.createClient(id, v.client_name, v.redirect_uris);
    return { client_id: id, ...v };
  }

  async validate(input: z.infer<typeof AuthorizationSchema>) {
    const v = AuthorizationSchema.parse(input);
    if (v.resource !== this.publicUrl) {
      throw new BadRequestException('Invalid resource');
    }
    const scopes = z.array(ScopeSchema).min(1).max(5).parse(v.scope.split(' '));
    const client = await this.oauth.findClient(v.client_id);
    if (!client?.redirect_uris.includes(v.redirect_uri)) {
      throw new BadRequestException('Unregistered client or redirect URI');
    }
    return { request: v, clientName: client.name, scopes };
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
    await this.oauth.createCode({
      hash: await hash(code),
      userId,
      clientId: v.client_id,
      redirectUri: v.redirect_uri,
      challenge: v.code_challenge,
      audience: this.publicUrl,
      scopes,
      expiresAt: new Date(Date.now() + 300_000),
    });
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
    const scopes = await this.transactions.withTransaction(async (transaction) => {
      if (v.grant_type === 'refresh_token') {
        if (!v.refresh_token) {
          throw new BadRequestException('invalid_grant');
        }
        const result = await this.credentials.rotateOAuth(
          {
            previousRefreshHash: await hash(v.refresh_token),
            accessHash,
            refreshHash,
            expiresAt,
            clientId: v.client_id,
            audience: this.publicUrl,
          },
          transaction,
        );
        if (!result) {
          throw new BadRequestException('invalid_grant');
        }
        return result.scopes as Scope[];
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
      const code = await this.oauth.consumeCode(
        {
          hash: await hash(v.code),
          clientId: v.client_id,
          redirectUri: v.redirect_uri,
          challenge,
          audience: this.publicUrl,
        },
        transaction,
      );
      if (!code) {
        throw new BadRequestException('invalid_grant');
      }
      const client = await this.oauth.findClient(v.client_id, transaction);
      if (!client) {
        throw new BadRequestException('invalid_grant');
      }
      await this.credentials.createOAuth(
        {
          userId: code.user_id,
          name: client.name,
          accessHash,
          refreshHash,
          clientId: v.client_id,
          audience: this.publicUrl,
          scopes: code.scopes,
          expiresAt,
          refreshExpiresAt: new Date(Date.now() + 30 * 86_400_000),
        },
        transaction,
      );
      return code.scopes as Scope[];
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
    await this.credentials.revokeOAuth(clientId, digest);
  }
}
