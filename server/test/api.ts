import type { ApiDependencies } from 'src/api/app';
import { AUTH_SECRET, createAccessToken, type AuthenticatedUser } from 'src/auth';

type ApiDependencyOverrides = {
  [Key in keyof ApiDependencies]?: Partial<ApiDependencies[Key]>;
};

export const TEST_API_USER: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.com',
  role: 'user',
  firstName: 'Test',
  lastName: 'User',
};

export const apiAuthHeaders = (user: AuthenticatedUser = TEST_API_USER) => ({
  Authorization: `Bearer ${createAccessToken(user, AUTH_SECRET)}`,
});

export const newApiUsers = (user: AuthenticatedUser = TEST_API_USER): ApiDependencies['users'] => ({
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

export const newApiDependencies = (overrides: ApiDependencyOverrides = {}): ApiDependencies =>
  ({
    activities: { ...overrides.activities },
    activityImages: { ...overrides.activityImages },
    auth: { ...overrides.auth },
    config: { registrationEnabled: false, ...overrides.config },
    files: { ...overrides.files },
    jobs: { ...overrides.jobs },
    liveWorkouts: { ...overrides.liveWorkouts },
    server: { ...overrides.server },
    social: { ...overrides.social },
    uploads: { ...overrides.uploads },
    uploadService: { ...overrides.uploadService },
    userService: { ...overrides.userService },
    users: { ...overrides.users },
  }) as ApiDependencies;
