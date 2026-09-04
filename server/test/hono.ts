import { AUTH_SECRET, createAccessToken, type AuthenticatedUser } from 'src/auth';
import type { HonoDependencies } from 'src/hono/app';

type HonoDependencyOverrides = {
  [Key in keyof HonoDependencies]?: Partial<HonoDependencies[Key]>;
};

export const TEST_HONO_USER: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.com',
  role: 'user',
  firstName: 'Test',
  lastName: 'User',
};

export const honoAuthHeaders = (user: AuthenticatedUser = TEST_HONO_USER) => ({
  Authorization: `Bearer ${createAccessToken(user, AUTH_SECRET)}`,
});

export const newHonoUsers = (user: AuthenticatedUser = TEST_HONO_USER): HonoDependencies['users'] => ({
  all: () => Promise.resolve([]),
  findById: (id) =>
    Promise.resolve(
      id === user.id
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            first_name: user.firstName,
            last_name: user.lastName,
          }
        : undefined,
    ),
});

export const newHonoDependencies = (overrides: HonoDependencyOverrides = {}): HonoDependencies =>
  ({
    activities: { ...overrides.activities },
    files: { ...overrides.files },
    server: { ...overrides.server },
    social: { ...overrides.social },
    userService: { ...overrides.userService },
    users: { ...overrides.users },
  }) as HonoDependencies;
