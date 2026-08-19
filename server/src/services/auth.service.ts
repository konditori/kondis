import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { timingSafeEqual } from 'node:crypto';
import { createAccessToken, createActivityEventsTicket } from 'src/auth';
import { ConfigService } from 'src/config/config.service';
import { UserRepository } from 'src/repositories/user.repository';
const BCRYPT_WORK_FACTOR = 12;
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly config: ConfigService,
  ) {}
  get registrationEnabled() {
    return this.config.registrationEnabled;
  }
  async setupStatus() {
    const row = await this.users.count();
    return { setupRequired: Number(row.count) === 0 };
  }
  async logSetupTokenIfRequired() {
    if ((await this.setupStatus()).setupRequired) {
      this.logger.warn(`No administrator account exists. Use setup token: ${this.config.setupToken}`);
    }
  }
  async setup(email: string, firstName: string, lastName: string, password: string, setupToken: string) {
    this.logger.log(`Initial account setup attempt for ${email || '<missing email>'}`);
    try {
      if (!this.matchesSetupToken(setupToken)) {
        throw new UnauthorizedException('Invalid setup token');
      }
      const account = this.normalizeAccount(email, firstName, lastName, password);
      const user = await this.users.createInitialAdmin({
        ...account,
        password_hash: await hash(password, BCRYPT_WORK_FACTOR),
        role: 'admin',
      });
      if (!user) {
        throw new ConflictException('Initial admin already exists');
      }
      this.logger.log(`Initial administrator account created for ${user.email}`);
      return this.issue(user, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Initial account setup failed for ${email || '<missing email>'}: ${message}`, stack);
      throw error;
    }
  }
  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email.toLowerCase());
    const isValid = user ? await compare(password, user.password_hash) : false;
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
      const user = await this.create(email, firstName, lastName, password, 'user');
      this.logger.log(`Public user account created for ${user.email} (${user.id})`);
      return this.issue(user, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Public user account creation failed for ${email}: ${message}`);
      throw error;
    }
  }
  createActivityEventsTicket(userId: string) {
    return createActivityEventsTicket(userId, this.config.authSecret);
  }
  async create(email: string, firstName: string, lastName: string, password: string, role: 'admin' | 'user') {
    const account = this.normalizeAccount(email, firstName, lastName, password);
    if (await this.users.findByEmail(account.email)) {
      throw new ConflictException('Email is already in use');
    }
    const user = await this.users.create({
      ...account,
      password_hash: await hash(password, BCRYPT_WORK_FACTOR),
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

  private matchesSetupToken(candidate: string): boolean {
    const actual = Buffer.from(this.config.setupToken);
    const supplied = Buffer.from(candidate);
    return actual.length === supplied.length && timingSafeEqual(actual, supplied);
  }
  private issue(
    user: { id: string; role: 'admin' | 'user'; email: string; first_name: string; last_name: string },
    setup: boolean,
  ) {
    return {
      accessToken: createAccessToken(
        {
          id: user.id,
          role: user.role,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        },
        this.config.authSecret,
      ),
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
