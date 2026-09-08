import { ActivityType } from 'src/enum';

const METERS_PER_SECOND = 4.7;
const TICK_MS = 10_000;
const STARTED_AT_KEY = 'demo-live-tracker-started-at';
const CLIENT_SESSION_ID_KEY = 'demo-live-tracker-client-session-id';

const ROUTE: [number, number][] = [
  [-122.476537, 37.806576],
  [-122.477797, 37.800752],
  [-122.479323, 37.796756],
  [-122.480939, 37.792838],
  [-122.485026, 37.78389],
  [-122.50043, 37.775581],
  [-122.51112, 37.771163],
  [-122.51047, 37.767378],
  [-122.507304, 37.749146],
  [-122.500669, 37.734992],
  [-122.501619, 37.728693],
  [-122.499015, 37.716087],
  [-122.495134, 37.698606],
  [-122.489087, 37.685411],
  [-122.486405, 37.669226],
  [-122.485502, 37.658021],
  [-122.490887, 37.649711],
  [-122.485188, 37.622235],
  [-122.497757, 37.606994],
  [-122.496915, 37.596734],
  [-122.487774, 37.594654],
  [-122.496646, 37.593721],
  [-122.505758, 37.594034],
  [-122.504684, 37.589256],
  [-122.507439, 37.584976],
  [-122.513982, 37.56783],
  [-122.511934, 37.550604],
  [-122.510984, 37.525027],
  [-122.47558, 37.502929],
  [-122.446155, 37.483134],
  [-122.430208, 37.468044],
  [-122.429923, 37.455433],
  [-122.426509, 37.427659],
  [-122.405339, 37.386269],
  [-122.397722, 37.358794],
  [-122.397967, 37.358752],
  [-122.394653, 37.343514],
  [-122.398373, 37.326695],
  [-122.406394, 37.294393],
  [-122.41128, 37.26666],
  [-122.415393, 37.236552],
  [-122.405432, 37.212188],
  [-122.394426, 37.183288],
  [-122.36094, 37.166223],
  [-122.31163, 37.129696],
  [-122.284604, 37.101738],
  [-122.269374, 37.085423],
  [-122.228274, 37.039936],
  [-122.215511, 37.028007],
  [-122.198686, 37.013086],
  [-122.18637, 37.006548],
  [-122.175329, 37.010218],
  [-122.149095, 37.036696],
  [-122.135713, 37.029492],
  [-122.124588, 37.014684],
  [-122.112836, 37.016938],
  [-122.111893, 37.006919],
  [-122.105973, 37.006331],
  [-122.106053, 37.006636],
  [-122.112195, 37.007592],
  [-122.108486, 37.018758],
  [-122.105256, 37.025172],
  [-122.090193, 37.024298],
  [-122.0731, 37.003246],
  [-122.06913, 36.988802],
  [-122.048737, 36.977677],
  [-122.031852, 36.976396],
  [-122.029689, 36.98436],
  [-122.018145, 36.988887],
  [-121.971497, 36.983346],
  [-121.952863, 36.978468],
  [-121.938332, 36.980753],
  [-121.899524, 36.974821],
  [-121.872583, 36.96986],
  [-121.86025, 36.942058],
  [-121.860586, 36.932149],
  [-121.836536, 36.895674],
  [-121.830397, 36.884444],
  [-121.837338, 36.896493],
  [-121.776975, 36.894341],
  [-121.770522, 36.868238],
  [-121.77109, 36.830713],
  [-121.785826, 36.819545],
  [-121.783188, 36.799412],
  [-121.76634, 36.771819],
  [-121.76613, 36.753841],
  [-121.793766, 36.718547],
  [-121.807737, 36.680272],
  [-121.816472, 36.661962],
  [-121.818162, 36.645223],
  [-121.839804, 36.62587],
  [-121.853327, 36.613579],
  [-121.869732, 36.600726],
  [-121.894457, 36.606856],
  [-121.905813, 36.61669],
  [-121.899284, 36.61069],
  [-121.893552, 36.599848],
  [-121.899193, 36.587627],
  [-121.912979, 36.573638],
  [-121.911658, 36.564137],
  [-121.910077, 36.549164],
  [-121.913957, 36.534851],
  [-121.930084, 36.515617],
  [-121.915072, 36.511473],
  [-121.934871, 36.517919],
  [-121.937011, 36.495917],
  [-121.932932, 36.469707],
  [-121.914543, 36.41003],
  [-121.900149, 36.383581],
  [-121.899461, 36.365196],
  [-121.891121, 36.341464],
  [-121.886461, 36.309511],
  [-121.900407, 36.305242],
  [-121.897566, 36.305026],
  [-121.842026, 36.287174],
  [-121.807563, 36.269622],
  [-121.78485, 36.249224],
  [-121.760362, 36.22568],
  [-121.754103, 36.220529],
  [-121.752446, 36.214446],
  [-121.748375, 36.211152],
  [-121.752876, 36.214831],
  [-121.744492, 36.212363],
  [-121.728078, 36.201621],
  [-121.71165, 36.19675],
  [-121.700231, 36.182805],
  [-121.69533, 36.176918],
  [-121.692816, 36.174168],
  [-121.670343, 36.156564],
  [-121.655145, 36.143496],
  [-121.621246, 36.103074],
  [-121.610767, 36.078877],
  [-121.589792, 36.049671],
  [-121.544669, 36.020359],
  [-121.508755, 36.00525],
  [-121.483588, 35.968606],
  [-121.469064, 35.916763],
  [-121.46054, 35.88804],
  [-121.45381, 35.890273],
  [-121.440537, 35.890307],
  [-121.433159, 35.88912],
  [-121.4293, 35.885863],
  [-121.406388, 35.887407],
  [-121.411944, 35.88502],
  [-121.428063, 35.888673],
  [-121.43428, 35.889244],
  [-121.44224, 35.889559],
  [-121.457156, 35.892016],
  [-121.445697, 35.875609],
  [-121.411434, 35.853861],
  [-121.392007, 35.836118],
  [-121.377839, 35.822725],
  [-121.361834, 35.811902],
  [-121.358964, 35.810869],
  [-121.353446, 35.805967],
  [-121.348933, 35.802025],
  [-121.346774, 35.797184],
  [-121.337892, 35.788481],
  [-121.329102, 35.779099],
  [-121.321723, 35.769144],
  [-121.315448, 35.755985],
  [-121.303858, 35.708938],
  [-121.264709, 35.665719],
  [-121.218053, 35.653166],
  [-121.1859, 35.643652],
  [-121.14947, 35.617579],
  [-121.125549, 35.595322],
  [-121.107295, 35.565184],
  [-121.091305, 35.562771],
  [-121.072772, 35.561201],
  [-121.044921, 35.527308],
  [-120.998085, 35.485272],
  [-120.944428, 35.451483],
  [-120.902101, 35.452619],
  [-120.878602, 35.423291],
  [-120.855646, 35.380145],
  [-120.855534, 35.369712],
  [-120.8543, 35.376875],
  [-120.873011, 35.413024],
  [-120.899911, 35.451083],
  [-120.940267, 35.45071],
  [-120.996267, 35.482132],
  [-121.043021, 35.524059],
  [-121.072966, 35.558515],
  [-121.089641, 35.562722],
  [-121.107925, 35.564231],
  [-121.124297, 35.591889],
  [-121.146079, 35.614693],
  [-121.185678, 35.643626],
  [-121.212862, 35.652408],
  [-121.260548, 35.664631],
  [-121.30427, 35.704673],
  [-121.311862, 35.752625],
  [-121.322152, 35.768162],
  [-121.327943, 35.777076],
  [-121.33686, 35.788483],
  [-121.34643, 35.796654],
  [-121.348555, 35.801261],
  [-121.35248, 35.805295],
  [-121.359801, 35.809774],
  [-121.361063, 35.813768],
  [-121.376742, 35.821032],
  [-121.392616, 35.835136],
  [-121.409853, 35.852387],
  [-121.443404, 35.871843],
  [-121.458169, 35.891662],
  [-121.444515, 35.890226],
  [-121.43482, 35.888421],
  [-121.42713, 35.889352],
  [-121.41407, 35.884656],
  [-121.403593, 35.887851],
  [-121.429442, 35.884986],
  [-121.431517, 35.889431],
  [-121.441205, 35.891486],
  [-121.452985, 35.890337],
  [-121.460382, 35.887105],
  [-121.469039, 35.914805],
  [-121.483436, 35.967836],
  [-121.506166, 36.003373],
  [-121.541531, 36.020199],
  [-121.585667, 36.045694],
  [-121.606778, 36.07644],
  [-121.620378, 36.099524],
  [-121.647745, 36.136318],
  [-121.668411, 36.155053],
  [-121.692214, 36.173403],
  [-121.694386, 36.177129],
  [-121.699878, 36.180626],
  [-121.711419, 36.196752],
  [-121.726411, 36.20203],
  [-121.742908, 36.212526],
  [-121.753326, 36.215141],
  [-121.748407, 36.211396],
  [-121.750982, 36.2134],
  [-121.754157, 36.219927],
  [-121.759723, 36.225306],
  [-121.782056, 36.247755],
  [-121.805967, 36.268461],
  [-121.841271, 36.286334],
  [-121.89762, 36.305811],
  [-121.900491, 36.305454],
  [-121.886631, 36.309552],
  [-121.890714, 36.340956],
  [-121.899392, 36.364448],
  [-121.900351, 36.382325],
  [-121.913699, 36.409139],
  [-121.931322, 36.468467],
  [-121.937674, 36.494233],
  [-121.935199, 36.517795],
  [-121.915429, 36.511741],
  [-121.929811, 36.51471],
  [-121.914415, 36.534368],
  [-121.909791, 36.547317],
  [-121.911577, 36.563956],
  [-121.91287, 36.572928],
  [-121.900666, 36.584953],
  [-121.896425, 36.598347],
  [-121.899463, 36.610897],
  [-121.905486, 36.616453],
  [-121.894579, 36.606398],
  [-121.86819, 36.601191],
  [-121.86074, 36.607093],
  [-121.847219, 36.619617],
  [-121.832938, 36.63374],
  [-121.815498, 36.652714],
  [-121.807738, 36.67705],
  [-121.803564, 36.698681],
  [-121.773195, 36.742947],
  [-121.765089, 36.768375],
  [-121.782312, 36.787767],
  [-121.785241, 36.811111],
  [-121.776571, 36.825154],
  [-121.771096, 36.853816],
  [-121.77184, 36.880976],
  [-121.802298, 36.88697],
  [-121.82815, 36.884208],
  [-121.828191, 36.884357],
  [-121.839502, 36.922401],
  [-121.85783, 36.939241],
  [-121.864327, 36.956184],
  [-121.886044, 36.975048],
  [-121.916228, 36.981112],
  [-121.946793, 36.974789],
  [-121.961807, 36.982838],
  [-122.005078, 36.988405],
  [-122.021396, 36.991222],
  [-122.030694, 36.984006],
  [-122.031166, 36.974932],
  [-122.047824, 36.977882],
  [-122.068762, 36.987863],
  [-122.072792, 37.002642],
  [-122.088542, 37.023314],
  [-122.105268, 37.025424],
  [-122.108077, 37.019072],
  [-122.112604, 37.00816],
  [-122.106327, 37.007218],
  [-122.105796, 37.005696],
  [-122.111165, 37.005696],
  [-122.112273, 37.016384],
  [-122.123978, 37.013882],
  [-122.135216, 37.028592],
  [-122.147306, 37.036688],
  [-122.176288, 37.011796],
  [-122.185912, 37.006171],
  [-122.19746, 37.012407],
  [-122.214049, 37.026863],
  [-122.226806, 37.037727],
  [-122.264631, 37.080145],
  [-122.282743, 37.099264],
  [-122.30932, 37.126525],
  [-122.359496, 37.163199],
  [-122.391167, 37.184008],
  [-122.402818, 37.206598],
  [-122.414713, 37.233557],
  [-122.412376, 37.263205],
  [-122.405733, 37.291594],
  [-122.400072, 37.324283],
  [-122.39488, 37.341413],
  [-122.397065, 37.357731],
  [-122.39914, 37.35855],
  [-122.40435, 37.381164],
  [-122.426078, 37.4227],
  [-122.429523, 37.452294],
  [-122.42958, 37.467187],
  [-122.445202, 37.481857],
  [-122.473418, 37.502093],
  [-122.510082, 37.524111],
  [-122.511952, 37.549349],
  [-122.513533, 37.566845],
  [-122.507716, 37.584796],
  [-122.505044, 37.588929],
  [-122.505807, 37.593937],
  [-122.496964, 37.594017],
  [-122.487345, 37.594607],
  [-122.497108, 37.596503],
  [-122.497814, 37.606739],
  [-122.485432, 37.615998],
  [-122.491845, 37.643501],
  [-122.489208, 37.657964],
  [-122.48511, 37.66742],
  [-122.486929, 37.670713],
  [-122.489139, 37.686796],
  [-122.494861, 37.69845],
  [-122.500095, 37.7176],
  [-122.498146, 37.705589],
  [-122.50287, 37.724084],
  [-122.496785, 37.733767],
  [-122.502862, 37.735554],
  [-122.509353, 37.75992],
  [-122.510751, 37.769402],
  [-122.50043, 37.775581],
  [-122.485026, 37.78389],
  [-122.480939, 37.792838],
  [-122.479323, 37.796756],
  [-122.477797, 37.800752],
  [-122.476537, 37.806576],
];

const metersBetween = (from: [number, number], to: [number, number]): number => {
  const latitudeRadians = ((from[1] + to[1]) / 2) * (Math.PI / 180);
  const longitudeMeters = (to[0] - from[0]) * 111_320 * Math.cos(latitudeRadians);
  const latitudeMeters = (to[1] - from[1]) * 110_574;
  return Math.hypot(longitudeMeters, latitudeMeters);
};

const TRAIL_SEGMENTS = (() => {
  let startDistance = 0;
  return ROUTE.slice(1).map((point, index) => {
    const start = ROUTE[index]!;
    const length = metersBetween(start, point);
    const segment = { point, start, startDistance, length };
    startDistance += length;
    return segment;
  });
})();
const TRAIL_LENGTH_METERS = TRAIL_SEGMENTS.at(-1)!.startDistance + TRAIL_SEGMENTS.at(-1)!.length;

const pointAtDistance = (distance: number): [number, number] => {
  const normalizedDistance = ((distance % TRAIL_LENGTH_METERS) + TRAIL_LENGTH_METERS) % TRAIL_LENGTH_METERS;
  const segment =
    TRAIL_SEGMENTS.find(({ startDistance, length }) => normalizedDistance <= startDistance + length) ??
    TRAIL_SEGMENTS.at(-1)!;
  const progress = Math.min(1, Math.max(0, (normalizedDistance - segment.startDistance) / segment.length));
  return [
    segment.start[0] + (segment.point[0] - segment.start[0]) * progress,
    segment.start[1] + (segment.point[1] - segment.start[1]) * progress,
  ];
};

export const DEMO_LIVE_TRACKER_NAME = 'demo-runner';
export const DEMO_LIVE_INGESTION_HOST = 'demo-live-ingestion.internal';
export const DEMO_LIVE_INGESTION_PATH = '/api/v1/_internal/demo-live-tracker';

export type DemoLiveTrackerNamespaceBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => {
    fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
  };
};

export type DemoLiveIngestionBinding = {
  fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
};

type DemoLiveTrackerState = {
  storage: {
    get: <T>(key: string) => Promise<T | undefined>;
    put: (key: string, value: number | string) => Promise<void>;
    setAlarm: (scheduledTime: number | Date) => Promise<void>;
  };
};

type DemoLiveTrackerEnv = {
  DEMO_LIVE_INGESTION?: DemoLiveIngestionBinding;
};

export class DemoLiveTracker {
  private startedAt?: number;
  private startedAtPromise?: Promise<number>;
  private clientSessionId?: string;
  private clientSessionIdPromise?: Promise<string>;

  constructor(
    private readonly state: DemoLiveTrackerState,
    private readonly env: DemoLiveTrackerEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/activate' || request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }
    try {
      await this.ingest();
      return new Response(null, { status: 204 });
    } finally {
      await this.scheduleNextTick();
    }
  }

  async alarm(): Promise<void> {
    try {
      await this.ingest();
    } catch (error) {
      console.error('Demo live tracker ingestion failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Keep the simulated device alive through transient API failures. Durable
      // Object alarms only retry a finite number of uncaught failures.
      await this.scheduleNextTick();
    }
  }

  private async ingest(): Promise<void> {
    if (!this.env.DEMO_LIVE_INGESTION) {
      throw new Error('DEMO_LIVE_INGESTION is required for the demo live tracker');
    }
    const startedAt = await this.getStartedAt();
    const now = Date.now();
    const elapsedMilliseconds = Math.max(0, now - startedAt);
    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
    const sequence = Math.floor(elapsedMilliseconds / TICK_MS) + 1;
    const distanceMeters = elapsedSeconds * METERS_PER_SECOND;
    const [longitude, latitude] = pointAtDistance(distanceMeters);
    const clientSessionId = await this.getClientSessionId();
    const response = await this.env.DEMO_LIVE_INGESTION.fetch(
      new Request(`https://${DEMO_LIVE_INGESTION_HOST}${DEMO_LIVE_INGESTION_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientSessionId,
          sport: ActivityType.Run,
          startedAt: new Date(startedAt).toISOString(),
          elapsedSeconds,
          distanceMeters,
          points: [
            {
              sequence,
              recordedAt: new Date(startedAt + elapsedMilliseconds).toISOString(),
              latitude,
              longitude,
              altitude: 28,
              accuracyMeters: 5,
            },
          ],
        }),
      }),
    );
    if (!response.ok) {
      throw new Error(`Demo live ingestion returned HTTP ${response.status}`);
    }
  }

  private async getStartedAt(): Promise<number> {
    if (this.startedAt !== undefined) {
      return this.startedAt;
    }
    this.startedAtPromise ??= (async () => {
      const stored = await this.state.storage.get<number>(STARTED_AT_KEY);
      const startedAt = stored ?? Date.now();
      if (stored === undefined) {
        await this.state.storage.put(STARTED_AT_KEY, startedAt);
      }
      this.startedAt = startedAt;
      return startedAt;
    })();
    return this.startedAtPromise;
  }

  private async getClientSessionId(): Promise<string> {
    if (this.clientSessionId !== undefined) {
      return this.clientSessionId;
    }
    this.clientSessionIdPromise ??= (async () => {
      const stored = await this.state.storage.get<string>(CLIENT_SESSION_ID_KEY);
      const clientSessionId = stored ?? crypto.randomUUID();
      if (stored === undefined) {
        await this.state.storage.put(CLIENT_SESSION_ID_KEY, clientSessionId);
      }
      this.clientSessionId = clientSessionId;
      return clientSessionId;
    })();
    return this.clientSessionIdPromise;
  }

  private async scheduleNextTick(): Promise<void> {
    const startedAt = await this.getStartedAt();
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / TICK_MS));
    const nextTickAt = startedAt + (elapsedSeconds + 1) * TICK_MS;
    await this.state.storage.setAlarm(Math.max(nextTickAt, now + 1));
  }
}
