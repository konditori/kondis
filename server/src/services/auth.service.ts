import { JobStatus } from 'src/enum';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from 'src/errors';
import { Logger } from 'src/logger';
import type { ConfigPort } from 'src/ports/config.port';
import type { CryptoPort } from 'src/ports/crypto.port';
import type { RealtimePort } from 'src/ports/realtime.port';
import type { TransactionPort } from 'src/ports/transaction.port';
import { AuthCredentialRepository } from 'src/repositories/auth-credential.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { UserRepository } from 'src/repositories/user.repository';
import type { KondisExecutor } from 'src/types';
const BCRYPT_WORK_FACTOR = 12;
const SETUP_TOKEN_RATE_LIMIT = { label: 'Setup token', maxAttempts: 5, windowMs: 60_000 } as const;
const EVENT_TICKET_RATE_LIMIT = { label: 'Event ticket', maxAttempts: 10, windowMs: 60_000 } as const;
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly config: Pick<ConfigPort, 'registrationEnabled' | 'setupToken'>,
    private readonly rateLimitingRepository: RateLimitingRepository,
    private readonly crypto: CryptoPort,
    private readonly credentials: AuthCredentialRepository,
    private readonly events: RealtimePort,
    private readonly database: TransactionPort,
  ) {}
  get registrationEnabled() {
    return this.config.registrationEnabled;
  }
  async setupStatus() {
    const row = await this.users.count();
    return { setupRequired: Number(row.count) === 0 };
  }
  async logSetupTokenIfRequired() {
    const status = await this.setupStatus();
    if (status.setupRequired) {
      const setupToken = await this.credentials.getOrCreateSetupToken(this.config.setupToken);
      if (!setupToken) {
        return;
      }
      this.logger.log(`
================================================================================
Welcome to Kondis!

For initial setup, go to the app in a web browser (not mobile app)

You will need the following setup token:

  ${setupToken}

Do not share this secret token with anyone.

================================================================================
`);
    }
  }
  async verifySetupToken(setupToken: string, clientId = 'unknown') {
    await this.rateLimitingRepository.consume(clientId, SETUP_TOKEN_RATE_LIMIT);
    const status = await this.setupStatus();
    if (!status.setupRequired) {
      throw new ConflictException('Initial setup is already complete');
    }
    if (!(await this.credentials.verifySetupToken(setupToken))) {
      this.logger.warn('Invalid setup token supplied during initial setup verification');
      throw new UnauthorizedException('Invalid setup token');
    }
    return this.credentials.createTicket('initial-setup');
  }
  async validateSetupTicket(setupTicket: string) {
    const status = await this.setupStatus();
    if (!status.setupRequired || !(await this.credentials.findTicket(setupTicket, 'initial-setup'))) {
      throw new UnauthorizedException('Setup verification is no longer valid');
    }
    return { valid: true };
  }
  async setup(email: string, firstName: string, lastName: string, password: string, setupTicket: string) {
    this.logger.log(`Initial account setup attempt for ${email || '<missing email>'}`);
    try {
      if (!(await this.credentials.findTicket(setupTicket, 'initial-setup'))) {
        throw new UnauthorizedException('Verify the setup token before creating the administrator account');
      }
      const account = this.normalizeAccount(email, firstName, lastName, password);
      const passwordHash = await this.crypto.hashPassword(password, BCRYPT_WORK_FACTOR);
      return await this.database.withTransaction(async (transaction) => {
        if (!(await this.credentials.consumeSetupBootstrap(transaction))) {
          throw new ConflictException('Initial setup is already complete');
        }
        if (!(await this.credentials.consumeTicket(setupTicket, 'initial-setup', transaction))) {
          throw new UnauthorizedException('Verify the setup token before creating the administrator account');
        }
        await this.credentials.clearSetupTickets(transaction);
        const user = await this.users.createInitialAdmin(
          {
            ...account,
            password_hash: passwordHash,
            role: 'admin',
          },
          transaction,
        );
        if (!user) {
          throw new ConflictException('Initial admin already exists');
        }
        this.logger.log(`Initial administrator account created for ${user.email}`);
        return this.issue(user, true, transaction);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Initial account setup failed for ${email || '<missing email>'}: ${message}`, stack);
      throw error;
    }
  }
  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email.toLowerCase());
    const isValid = user ? await this.crypto.comparePassword(password, user.password_hash) : false;
    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue(user, false);
  }
  async register(email: string, firstName: string, lastName: string, password: string) {
    if (!this.config.registrationEnabled) {
      throw new ForbiddenException('Public registration is disabled');
    }
    this.logger.log(`Creating public user account for ${email}`);
    try {
      const account = this.normalizeAccount(email, firstName, lastName, password);
      const passwordHash = await this.crypto.hashPassword(password, BCRYPT_WORK_FACTOR);
      return await this.database.withTransaction(async (transaction) => {
        if (await this.users.findByEmail(account.email, transaction)) {
          throw new ConflictException('Email is already in use');
        }
        const user = await this.users.create({ ...account, password_hash: passwordHash, role: 'user' }, transaction);
        this.logger.log(`Public user account created for ${user.email} (${user.id})`);
        return this.issue(user, false, transaction);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Public user account creation failed for ${email}: ${message}`);
      throw error;
    }
  }
  async createActivityEventsTicket(userId: string, sessionId: string) {
    await this.rateLimitingRepository.consume(`activity:${sessionId}`, EVENT_TICKET_RATE_LIMIT);
    return this.credentials.createTicket('activity-events', userId, sessionId);
  }
  async createJobEventsTicket(userId: string, sessionId: string) {
    await this.rateLimitingRepository.consume(`job:${sessionId}`, EVENT_TICKET_RATE_LIMIT);
    return this.credentials.createTicket('job-events', userId, sessionId);
  }
  async revokeSession(sessionId: string) {
    await this.credentials.revokeSession(sessionId);
    try {
      await this.events.emit('SessionRevoked', sessionId);
    } catch (error) {
      this.logger.warn(
        `Session ${sessionId} was revoked but realtime clients could not be notified: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  async handleCredentialCleanup(): Promise<JobStatus> {
    await this.credentials.deleteExpired();
    return JobStatus.Success;
  }
  async create(email: string, firstName: string, lastName: string, password: string, role: 'admin' | 'user') {
    const account = this.normalizeAccount(email, firstName, lastName, password);
    if (await this.users.findByEmail(account.email)) {
      throw new ConflictException('Email is already in use');
    }
    const user = await this.users.create({
      ...account,
      password_hash: await this.crypto.hashPassword(password, BCRYPT_WORK_FACTOR),
      role,
    });
    return user;
  }

  private normalizeAccount(email: string, firstName: string, lastName: string, password: string) {
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || !firstName.trim() || !lastName.trim()) {
      throw new BadRequestException('Use a first name, last name, valid email, and password of at least 10 characters');
    }
    return { email: email.toLowerCase(), first_name: firstName.trim(), last_name: lastName.trim() };
  }

  private async issue(
    user: { id: string; role: 'admin' | 'user'; email: string; first_name: string; last_name: string },
    setup: boolean,
    executor?: KondisExecutor,
  ) {
    return {
      accessToken: await this.credentials.createSession(user.id, executor),
      setup,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        avatarUrl: 'avatar_path' in user && user.avatar_path ? `/api/v1/users/${user.id}/avatar` : null,
      },
    };
  }
}
