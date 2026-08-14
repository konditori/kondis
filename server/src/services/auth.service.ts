import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createAccessToken } from 'src/auth';
import { ConfigService } from 'src/config/config.service';
import { UserRepository } from 'src/repositories/user.repository';
const hash = (password: string, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const matches = (password: string, stored: string) => { const [salt, digest] = stored.split(':'); const actual = hash(password, salt).split(':')[1]; return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(digest, 'hex')); };
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly users: UserRepository, private readonly config: ConfigService) {}
  async setupStatus() { const row = await this.users.count(); return { setupRequired: Number(row.count) === 0 }; }
  async setup(email: string, name: string, password: string) {
    this.logger.log(`Initial account setup attempt for ${email || '<missing email>'}`);
    try {
      if (!(await this.setupStatus()).setupRequired) throw new ConflictException('Initial admin already exists');
      const user = await this.create(email, name, password, 'admin');
      this.logger.log(`Initial administrator account created for ${user.email}`);
      return this.issue(user, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Initial account setup failed for ${email || '<missing email>'}: ${message}`, stack);
      throw error;
    }
  }
  async login(email: string, password: string) { const user = await this.users.findByEmail(email.toLowerCase()); if (!user || !matches(password, user.password_hash)) throw new UnauthorizedException('Invalid email or password'); return this.issue(user, false); }
  async create(email: string, name: string, password: string, role: 'admin' | 'user') { if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || !name.trim()) throw new BadRequestException('Use a name, valid email, and password of at least 10 characters'); if (await this.users.findByEmail(email.toLowerCase())) throw new ConflictException('Email is already in use'); const user = await this.users.create({ email: email.toLowerCase(), name: name.trim(), password_hash: hash(password), role }); if (role === 'admin') await this.users.adoptOrphanedData(user.id); return user; }
  private issue(user: { id: string; role: 'admin' | 'user'; email: string; name: string }, setup: boolean) { return { accessToken: createAccessToken(user, this.config.authSecret), setup, user: { id: user.id, email: user.email, name: user.name, role: user.role } }; }
}
