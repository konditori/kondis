import type { ApiDependencies } from 'src/api/app';
import type { AuthenticatedUser } from 'src/auth';

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

const sessions = new Map<string, AuthenticatedUser>();

export const apiAuthHeaders = (user: AuthenticatedUser = TEST_API_USER) => {
  const token = user.id.replaceAll('-', '').padEnd(64, '0');
  sessions.set(token, user);
  return { Authorization: `Bearer ${token}` };
};

export const newApiSessions = (): ApiDependencies['sessions'] => ({
  findSession: (token) => {
    const user = sessions.get(token);
    return Promise.resolve(user ? { id: `session-${user.id}`, user } : undefined);
  },
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
    config: { registrationEnabled: false, trustProxyHeaders: false, ...overrides.config },
    files: { ...overrides.files },
    jobs: { ...overrides.jobs },
    liveWorkouts: { ...overrides.liveWorkouts },
    server: { ...overrides.server },
    sessions: { ...newApiSessions(), ...overrides.sessions },
    social: { ...overrides.social },
    uploads: { ...overrides.uploads },
    uploadService: { ...overrides.uploadService },
    userService: { ...overrides.userService },
    users: { ...overrides.users },
  }) as ApiDependencies;
