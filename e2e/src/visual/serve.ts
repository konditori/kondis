/* eslint-disable unicorn/no-null -- Match nullable API fields in fixtures. */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const user = {
  id: 'visual-user',
  email: 'runner@example.invalid',
  firstName: 'Alex',
  lastName: 'Runner',
  role: 'admin',
  avatarUrl: null,
};
const route: [number, number][] = Array.from({ length: 60 }, (_, index) => [
  18.06 + Math.sin(index / 10) * 0.01,
  59.33 + index * 0.0002,
]);
const activity = {
  id: 'visual-run',
  userId: user.id,
  athlete: user,
  sport: 'run',
  name: 'Morning run',
  description: 'An easy loop by the water before breakfast.',
  excludeFromRankings: false,
  tags: ['long_run'],
  startedAt: '2026-09-20T07:00:00Z',
  timezoneOffsetMinutes: 120,
  metrics: {
    elapsedTime: 2100,
    movingTime: 2050,
    distance: 6800,
    elevationGain: 64,
    elevationLoss: 60,
    avgSpeed: 3.31,
    avgHr: 148,
    calories: 425,
  },
  createdAt: '2026-09-20T07:00:00Z',
  updatedAt: '2026-09-20T07:00:00Z',
  track: { type: 'LineString', coordinates: route },
  images: [],
  likeCount: 3,
  commentCount: 0,
  viewerLiked: false,
  achievementCount: 0,
  topBestEfforts: [],
  bestEfforts: [],
  analysis: null,
  matchedRouteCount: 0,
};
const types = [
  { type: 'run', averageMetric: 'pace', showAveragePower: false, bestEffortGroup: 'run' },
  { type: 'ride', averageMetric: 'speed', showAveragePower: true, bestEffortGroup: 'ride' },
];
const servers: ReturnType<typeof createServer>[] = [];
function listen(port: number, handler: import('node:http').RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  server.listen(port, '127.0.0.1');
}
listen(2410, (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/^\/api\/v1/, '');
  const fixture = request.headers.authorization?.replace('Bearer ', '') ?? 'normal';
  let body: unknown = [];
  switch (path) {
    case '/auth/me': {
      body = user;
      break;
    }
    case '/auth/setup': {
      body = { setupRequired: false, registrationEnabled: true };
      break;
    }
    case '/activities/types': {
      body = types;
      break;
    }
    case '/photo.svg': {
      response
        .writeHead(200, { 'content-type': 'image/svg+xml' })
        .end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#d8d4ce"/><path d="M0 500 250 150 450 350 650 100 800 500" fill="#a9430e"/></svg>',
        );
      return;
    }
    case '/activities/visual-photos': {
      body = {
        ...activity,
        id: 'visual-photos',
        images: [1, 2].map((id) => ({
          id: `photo-${id}`,
          caption: `Sample route photo ${id}`,
          preview: 'http://127.0.0.1:2410/photo.svg',
          original: 'http://127.0.0.1:2410/photo.svg',
          thumbnail: null,
          width: 800,
          height: 500,
        })),
      };
      break;
    }
    case '/activities/visual-run': {
      body = activity;
      break;
    }
    case '/feed': {
      if (fixture === 'unavailable') {
        response.writeHead(503).end();
        return;
      }
      const count = fixture === 'long-feed' ? 200 : fixture === 'empty' ? 0 : 2;
      body = {
        activities: Array.from({ length: count }, (_, index) => ({
          ...activity,
          id: index ? `visual-${index}` : activity.id,
          name: index ? 'Evening ride' : activity.name,
          sport: index ? 'ride' : 'run',
          tags: index ? [] : activity.tags,
        })),
        nextCursor: null,
        total: count,
      };

      break;
    }
    case '/notifications': {
      body = { notifications: [], unreadCount: 0, nextCursor: null };
      break;
    }
    default: {
      if (path.endsWith('/comments')) {
        body = { comments: [], nextCursor: null };
      } else if (path.endsWith('/like')) {
        body = { liked: true, likeCount: 4 };
      }
    }
  }
  response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
});
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
for (const [port, site] of [
  [2412, 'kondis.org'],
  [2413, 'docs.kondis.org'],
  [2414, 'api.kondis.org'],
  [2415, 'developers.kondis.org'],
] as const) {
  const directory = resolve(root, 'sites', site, 'build');
  listen(port, (request, response) => {
    void (async () => {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      let file = resolve(directory, `.${pathname}`);
      if (!file.startsWith(directory + sep) && file !== directory) {
        response.writeHead(403).end();
        return;
      }
      if (!extname(file)) {
        file = resolve(file, 'index.html');
      }
      try {
        response
          .writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' })
          .end(await readFile(file));
      } catch {
        response.writeHead(404).end('Not found');
      }
    })();
  });
}
const web = spawn(process.execPath, ['web/build'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: '2411',
    ORIGIN: 'http://127.0.0.1:2411',
    KONDIS_API_URL: 'http://127.0.0.1:2410',
  },
});
function shutdown() {
  web.kill('SIGTERM');
  for (const server of servers) {
    server.close();
  }
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
web.once('exit', (code) => {
  shutdown();
  process.exitCode = code ?? 1;
});
