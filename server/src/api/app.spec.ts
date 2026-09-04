import { describe, expect, it, vi } from 'vitest';

import { createApiApp, createOpenApiDocument } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers } from 'test/api';

const findNoUser = (_id: string) => Promise.resolve(undefined);
const listNoUsers = () => Promise.resolve([]);
const operationMethods = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);
const expectedOperations = [
  'GET /ping ServerController_ping',
  'POST /upload/activity UploadController_uploadActivity',
  'POST /upload/strava UploadController_uploadStravaTakeout',
  'GET /upload/strava/{id} UploadController_getStravaTakeoutStatus',
  'GET /jobs JobController_getAllJobStatus',
  'POST /jobs JobController_createJob',
  'GET /jobs/history JobController_getJobHistory',
  'PUT /jobs/{name} JobController_runQueueCommand',
  'GET /live-workouts LiveWorkoutController_list',
  'POST /live-workouts LiveWorkoutController_create',
  'GET /live-workouts/shared/{token} LiveWorkoutController_getShared',
  'GET /live-workouts/{id} LiveWorkoutController_get',
  'PATCH /live-workouts/{id} LiveWorkoutController_update',
  'DELETE /live-workouts/{id} LiveWorkoutController_discard',
  'POST /live-workouts/{id}/points LiveWorkoutController_points',
  'POST /live-workouts/{id}/share LiveWorkoutController_share',
  'DELETE /live-workouts/{id}/share LiveWorkoutController_revokeShare',
  'GET /activities ActivityController_listRecent',
  'GET /activities/types ActivityController_listTypes',
  'GET /activities/tags ActivityController_listTags',
  'GET /activities/best-efforts/{sport}/{type} ActivityController_listBestEfforts',
  'GET /activities/{id} ActivityController_getById',
  'PUT /activities/{id} ActivityController_updateById',
  'DELETE /activities/{id} ActivityController_deleteById',
  'GET /activities/{id}/matched-routes ActivityController_listMatchedRoutes',
  'POST /activities/{id}/images ActivityImageController_upload',
  'GET /activities/{id}/images ActivityImageController_list',
  'PATCH /activities/{activityId}/images/{imageId} ActivityImageController_update',
  'DELETE /activities/{activityId}/images/{imageId} ActivityImageController_delete',
  'GET /activity-images/{imageId}/{variant} ActivityImageController_file',
  'GET /auth/capabilities AuthController_capabilities',
  'GET /auth/setup AuthController_setupStatus',
  'POST /auth/setup AuthController_setup',
  'POST /auth/setup/verify AuthController_verifySetupToken',
  'POST /auth/setup/validate AuthController_validateSetupTicket',
  'POST /auth/login AuthController_login',
  'POST /auth/register AuthController_register',
  'GET /auth/me AuthController_me',
  'POST /auth/activity-events-ticket AuthController_activityEventsTicket',
  'POST /auth/job-events-ticket AuthController_jobEventsTicket',
  'GET /users UserController_list',
  'POST /users UserController_create',
  'PATCH /users/me UserController_updateMe',
  'POST /users/me/avatar UserController_uploadAvatar',
  'DELETE /users/me/avatar UserController_deleteAvatar',
  'GET /users/{id}/avatar UserController_avatarFile',
  'GET /people SocialController_people',
  'GET /people/{id} SocialController_person',
  'GET /people/{id}/activities SocialController_activities',
  'POST /people/{id}/follow-request SocialController_send',
  'DELETE /people/{id}/follow-request SocialController_cancel',
  'DELETE /people/{id}/follow SocialController_unfollow',
  'PUT /people/{id}/block SocialController_block',
  'DELETE /people/{id}/block SocialController_unblock',
  'GET /follow-requests SocialController_requests',
  'POST /follow-requests/{id}/accept SocialController_accept',
  'DELETE /follow-requests/{id} SocialController_ignore',
  'GET /feed SocialController_feed',
  'PUT /activities/{id}/like SocialController_like',
  'DELETE /activities/{id}/like SocialController_unlike',
  'GET /activities/{id}/likes SocialController_likers',
  'GET /notifications SocialController_notifications',
  'PATCH /notifications/read SocialController_markNotificationsRead',
  'GET /activities/{id}/comments SocialController_comments',
  'POST /activities/{id}/comments SocialController_comment',
  'PATCH /activities/{activityId}/comments/{commentId} SocialController_updateComment',
  'DELETE /activities/{activityId}/comments/{commentId} SocialController_deleteComment',
] as const;

describe('API application', () => {
  it('serves the health check', async () => {
    const ping = vi.fn(() => ({ status: 'pong' }));
    const findById = vi.fn(findNoUser);
    const response = await createApiApp(
      newApiDependencies({ server: { ping }, users: { all: listNoUsers, findById } }),
    ).request('/ping');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'pong' });
    expect(ping).toHaveBeenCalledOnce();
    expect(findById).not.toHaveBeenCalled();
  });

  it('uses the existing internal error response shape', async () => {
    const error = new Error('test failure');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await createApiApp(
      newApiDependencies({
        server: {
          ping: () => {
            throw error;
          },
        },
        users: { all: listNoUsers, findById: vi.fn(findNoUser) },
      }),
    ).request('/ping');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });

  it('returns the standard JSON error shape for an unknown route', async () => {
    const response = await createApiApp(newApiDependencies({ users: newApiUsers() })).request('/missing', {
      headers: apiAuthHeaders(),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual({ statusCode: 404, message: 'Not Found' });
  });

  it('preserves the ping operation contract', () => {
    const document = createOpenApiDocument(
      createApiApp(
        newApiDependencies({
          server: { ping: () => ({ status: 'pong' }) },
          users: { all: listNoUsers, findById: vi.fn(findNoUser) },
        }),
      ),
    );

    expect(document.paths['/ping']?.get).toMatchObject({
      operationId: 'ServerController_ping',
      parameters: [],
      summary: 'Health check endpoint',
      tags: ['server'],
      responses: {
        200: {
          description: 'The API is reachable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PingResponseDto_Output' },
            },
          },
        },
      },
    });
  });

  it('preserves the complete path, method, and operation id contract', () => {
    const document = createOpenApiDocument(createApiApp(newApiDependencies()));
    const operations = Object.entries(document.paths)
      .flatMap(([path, pathItem]) =>
        Object.entries(pathItem ?? {})
          .filter(([method]) => operationMethods.has(method))
          .map(
            ([method, operation]) =>
              `${method.toUpperCase()} ${path} ${(operation as { operationId?: string }).operationId}`,
          ),
      )
      .toSorted();

    expect(operations).toEqual(expectedOperations.toSorted());
  });
});
