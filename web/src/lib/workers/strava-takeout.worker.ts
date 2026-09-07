import {
  BlobReader,
  BlobWriter,
  type FileEntry,
  ZipReader,
} from "@zip.js/zip.js";

const LIMITS = {
  activityBytes: 64 * 1024 * 1024,
  entries: 20_000,
  entryBytes: 64 * 1024 * 1024,
  expandedBytes: 512 * 1024 * 1024,
  ratio: 200,
  manifestBytes: 16 * 1024 * 1024,
  manifestRows: 100_000,
} as const;
const ACTIVITY_EXTENSIONS = new Set([".fit", ".gpx", ".tcx"]);
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".m4v", ".webm"]);

type ActivityItem = {
  itemKey: string;
  kind: "activity";
  originalName: string;
  name: string | null;
  description: string | null;
  sport?: string;
  tags: string[];
  entryName: string;
  gzip: boolean;
};
type ManualItem = {
  itemKey: string;
  kind: "manual";
  sourceId: string;
  name: string | null;
  description: string | null;
  sport: string;
  tags: string[];
  startedAt: string;
  elapsedTime: number;
  movingTime: number | null;
  distance: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  avgSpeed: number | null;
  maxSpeed: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
};
type ScanItem = ActivityItem | ManualItem;
type StartMessage = {
  type: "start";
  file: File;
  importId: string;
  apiBase: string;
};
type CancelMessage = { type: "cancel" };

let cancelled = false;

if (typeof self !== "undefined") {
  self.onmessage = (event: MessageEvent<StartMessage | CancelMessage>) => {
    if (event.data.type === "cancel") {
      cancelled = true;
      return;
    }
    cancelled = false;
    void extract(event.data).catch((error) =>
      post("error", { message: message(error) }),
    );
  };
}

async function extract({
  file,
  importId,
  apiBase,
}: StartMessage): Promise<void> {
  post("phase", { phase: "scanning" });
  const reader = new ZipReader(new BlobReader(file), {
    strictness: "strict",
    checkCrc32: true,
  });
  try {
    const entries = await reader.getEntries({
      strictness: "strict",
      filenameValidation: "strict",
    });
    validateZipEntries(entries);
    const entryByName = new Map(
      entries
        .filter((entry): entry is FileEntry => !entry.directory)
        .map((entry) => [entry.filename, entry]),
    );
    const manifestNames = [...entryByName.keys()].filter(
      (name) => name === "activities.csv" || name.endsWith("/activities.csv"),
    );
    if (manifestNames.length !== 1) {
      throw new Error(
        manifestNames.length === 0
          ? "ZIP archive does not contain activities.csv"
          : "ZIP archive contains more than one activities.csv",
      );
    }
    const manifestName = manifestNames[0];
    const archiveRoot = manifestName.slice(0, -"activities.csv".length);
    const activityRows = parseCsv(
      await readText(entryByName.get(manifestName)!, LIMITS.manifestBytes),
    );
    const headers = activityRows.shift();
    if (!headers) throw new Error("activities.csv is empty");
    if (activityRows.length > LIMITS.manifestRows)
      throw new Error("activities.csv contains too many rows");
    if (!headers.includes("Filename"))
      throw new Error("activities.csv does not contain a Filename column");

    // media.csv is intentionally read now so its validity is checked without
    // materialising photo/video payloads. Media transfer is a later R2-direct feature.
    const mediaEntry = entryByName.get(`${archiveRoot}media.csv`);
    const mediaRows = mediaEntry
      ? parseCsv(await readText(mediaEntry, LIMITS.manifestBytes))
      : [];
    if (mediaRows.length > LIMITS.manifestRows + 1)
      throw new Error("media.csv contains too many rows");

    const { items, extractionErrors } = scanActivities(
      activityRows,
      headers,
      archiveRoot,
      entryByName,
    );
    const scan = await request<{ pendingItemKeys: string[] }>(
      `${apiBase}/upload/strava/imports/${importId}/scan`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: items.map(withoutEntryName) }),
      },
    );
    const pending = new Set(scan.pendingItemKeys);
    const skipped = countSkippedMedia(entryByName, mediaRows, archiveRoot);
    post("scanned", {
      total: items.length,
      pending: pending.size,
      extractionErrors,
      skipped,
    });
    assertNotCancelled();

    post("phase", { phase: "uploading" });
    let uploaded = 0;
    let failures = extractionErrors;
    for (const item of items.filter(
      (item): item is ManualItem =>
        item.kind === "manual" && pending.has(item.itemKey),
    )) {
      try {
        await request(
          `${apiBase}/upload/strava/imports/${importId}/manual-activities`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
          },
        );
        uploaded += 1;
        post("uploaded", { uploaded, total: pending.size });
      } catch (error) {
        failures += 1;
        await reportItemFailure(
          apiBase,
          importId,
          item.itemKey,
          message(error),
        );
      }
      assertNotCancelled();
    }

    const activities = items.filter(
      (item): item is ActivityItem =>
        item.kind === "activity" && pending.has(item.itemKey),
    );
    await runWeightedPool(
      activities,
      3,
      (item) => {
        const entry = entryByName.get(item.entryName);
        return item.gzip ||
          (entry?.uncompressedSize ?? LIMITS.activityBytes) > 24 * 1024 * 1024
          ? 3
          : 1;
      },
      async (item) => {
        try {
          const entry = entryByName.get(item.entryName);
          if (!entry)
            throw new Error("Activity file is missing from the ZIP archive");
          const activity = item.gzip
            ? await gunzipEntry(entry)
            : await entry.getData(new BlobWriter(), {
                checkCrc32: true,
                strictness: "strict",
              });
          if (activity.size > LIMITS.activityBytes)
            throw new Error("Activity exceeds the 64 MiB expanded size limit");
          const body = new FormData();
          body.append("metadata", JSON.stringify(withoutEntryName(item)));
          body.append(
            "file",
            new File([activity], item.originalName, { type: activity.type }),
          );
          await request(
            `${apiBase}/upload/strava/imports/${importId}/activities`,
            {
              method: "POST",
              body,
            },
          );
          uploaded += 1;
          post("uploaded", { uploaded, total: pending.size });
        } catch (error) {
          failures += 1;
          await reportItemFailure(
            apiBase,
            importId,
            item.itemKey,
            message(error),
          );
        }
        assertNotCancelled();
      },
    );

    const final = await request(
      `${apiBase}/upload/strava/imports/${importId}/finalize`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extractionErrors: failures }),
      },
    );
    post("phase", { phase: "processing" });
    post("complete", { status: final, extractionErrors: failures, skipped });
  } finally {
    await reader.close();
  }
}

export function validateZipEntries(
  entries: Awaited<ReturnType<ZipReader<Blob>["getEntries"]>>,
): void {
  if (entries.length > LIMITS.entries)
    throw new Error(
      `ZIP archive contains too many entries (maximum ${LIMITS.entries})`,
    );
  const names = new Set<string>();
  let expanded = 0;
  for (const entry of entries) {
    const name = entry.filename;
    if (!isSafePath(name) || names.has(name))
      throw new Error(
        `ZIP archive contains an unsafe or duplicate entry path: ${name}`,
      );
    names.add(name);
    if (entry.directory) continue;
    if (entry.encrypted) throw new Error(`ZIP entry is encrypted: ${name}`);
    if (entry.symlink) throw new Error(`ZIP entry is a symbolic link: ${name}`);
    if (
      !Number.isSafeInteger(entry.compressedSize) ||
      !Number.isSafeInteger(entry.uncompressedSize) ||
      entry.compressedSize < 0 ||
      entry.uncompressedSize < 0
    ) {
      throw new Error(`ZIP entry has an invalid size: ${name}`);
    }
    if (entry.uncompressedSize > LIMITS.entryBytes)
      throw new Error(
        `ZIP entry exceeds the 64 MiB expanded size limit: ${name}`,
      );
    const ratio =
      entry.compressedSize === 0
        ? entry.uncompressedSize === 0
          ? 1
          : Infinity
        : entry.uncompressedSize / entry.compressedSize;
    if (ratio > LIMITS.ratio)
      throw new Error(
        `ZIP entry exceeds the ${LIMITS.ratio}:1 compression ratio limit: ${name}`,
      );
    expanded += entry.uncompressedSize;
    if (expanded > LIMITS.expandedBytes)
      throw new Error("ZIP archive exceeds the 512 MiB expanded size limit");
  }
}

const isSafePath = (value: string): boolean => {
  const path = value.endsWith("/") ? value.slice(0, -1) : value;
  return (
    Boolean(path) &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    !path.startsWith("/") &&
    !/^[a-zA-Z]:/.test(path) &&
    !path
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  );
};

export function decodeCsvText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function readText(entry: FileEntry, maximum: number): Promise<string> {
  if (entry.uncompressedSize > maximum)
    throw new Error(`Manifest ${entry.filename} exceeds its size limit`);
  const blob = await entry.getData(new BlobWriter(), {
    checkCrc32: true,
    strictness: "strict",
  });
  if (blob.size > maximum)
    throw new Error(`Manifest ${entry.filename} exceeds its size limit`);
  return decodeCsvText(new Uint8Array(await blob.arrayBuffer()));
}

function scanActivities(
  rows: string[][],
  headers: string[],
  root: string,
  entries: Map<string, FileEntry>,
) {
  const column = (name: string, occurrence = 0): number => {
    let found = 0;
    for (const [index, header] of headers.entries())
      if (header === name && found++ === occurrence) return index;
    return -1;
  };
  const value = (row: string[], name: string, occurrence = 0): string =>
    row[column(name, occurrence)]?.trim() ?? "";
  const number = (
    row: string[],
    name: string,
    occurrence = 0,
  ): number | null => {
    const parsed = Number(value(row, name, occurrence));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const items: ScanItem[] = [];
  const referenced = new Set<string>();
  let extractionErrors = 0;
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const filename = value(row, "Filename");
    const name = value(row, "Activity Name") || null;
    const description = value(row, "Activity Description") || null;
    const sport = activityType(value(row, "Activity Type"));
    const tags = ["true", "1", "yes"].includes(
      value(row, "Commute").toLowerCase(),
    )
      ? ["commute"]
      : [];
    if (!filename) {
      const startedAt = new Date(value(row, "Activity Date"));
      const elapsedTime = number(row, "Elapsed Time");
      if (Number.isNaN(startedAt.valueOf()) || elapsedTime === null) {
        extractionErrors += 1;
        continue;
      }
      const sourceId = value(row, "Activity ID") || `row:${rowNumber}`;
      items.push({
        itemKey: `manual:${sourceId}`,
        kind: "manual",
        sourceId,
        name,
        description,
        sport: sport ?? "other",
        tags,
        startedAt: startedAt.toISOString(),
        elapsedTime,
        movingTime: number(row, "Moving Time"),
        distance: number(row, "Distance", 1),
        elevationGain: number(row, "Elevation Gain"),
        elevationLoss: number(row, "Elevation Loss"),
        avgSpeed: number(row, "Average Speed"),
        maxSpeed: number(row, "Max Speed"),
        avgHr: number(row, "Average Heart Rate"),
        maxHr: number(row, "Max Heart Rate"),
        calories: number(row, "Calories"),
      });
      continue;
    }
    if (!isSafePath(filename)) {
      extractionErrors += 1;
      continue;
    }
    const gzip = filename.toLowerCase().endsWith(".gz");
    const originalName = filename.split("/").at(-1)!.replace(/\.gz$/i, "");
    if (!ACTIVITY_EXTENSIONS.has(extension(originalName))) continue;
    const entryName = `${root}${filename}`;
    if (!entries.has(entryName) || referenced.has(entryName)) {
      extractionErrors += 1;
      continue;
    }
    referenced.add(entryName);
    items.push({
      itemKey: `activity:${entryName}`,
      kind: "activity",
      originalName,
      name,
      description,
      sport,
      tags,
      entryName,
      gzip,
    });
  }
  return { items, extractionErrors };
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"' && field.length === 0) quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0)
    rows.push([...row, field.replace(/\r$/, "")]);
  if (rows[0]?.[0]?.charCodeAt(0) === 0xfeff) rows[0][0] = rows[0][0].slice(1);
  return rows;
}

const withoutEntryName = (
  item: ScanItem,
): Omit<ActivityItem, "entryName" | "gzip"> | ManualItem => {
  if (item.kind === "manual") return item;
  const { entryName: _entryName, gzip: _gzip, ...metadata } = item;
  return metadata;
};

function countSkippedMedia(
  entries: Map<string, FileEntry>,
  mediaRows: string[][],
  root: string,
) {
  let photos = 0;
  let videos = 0;
  let profileImages = 0;
  for (const name of entries.keys()) {
    const suffix = extension(name);
    if (
      name.startsWith(root) &&
      /(^|\/)profile\./i.test(name) &&
      IMAGE_EXTENSIONS.has(suffix)
    )
      profileImages += 1;
    else if (IMAGE_EXTENSIONS.has(suffix)) photos += 1;
    else if (VIDEO_EXTENSIONS.has(suffix)) videos += 1;
  }
  return {
    photos: Math.max(photos, Math.max(0, mediaRows.length - 1)),
    videos,
    profileImages,
  };
}

async function gunzipEntry(entry: FileEntry): Promise<Blob> {
  if (!("DecompressionStream" in self))
    throw new Error("This browser does not support gzip takeout activities");
  let compressedBytes = 0;
  let expandedBytes = 0;
  const compressed = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      compressedBytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  const expanded = compressed.readable
    .pipeThrough(
      new DecompressionStream("gzip") as unknown as TransformStream<
        Uint8Array,
        Uint8Array
      >,
    )
    .pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          expandedBytes += chunk.byteLength;
          if (expandedBytes > LIMITS.activityBytes)
            throw new Error(
              "GZIP activity exceeds the 64 MiB expanded size limit",
            );
          controller.enqueue(chunk);
        },
      }),
    );
  const blobPromise = new Response(expanded).blob();
  await entry.getData(compressed.writable, {
    checkCrc32: true,
    strictness: "strict",
  });
  const blob = await blobPromise;
  if (compressedBytes === 0 || expandedBytes / compressedBytes > LIMITS.ratio) {
    throw new Error(
      `GZIP activity exceeds the ${LIMITS.ratio}:1 compression ratio limit`,
    );
  }
  return blob;
}

async function request<T = unknown>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

async function runWeightedPool<T>(
  items: T[],
  capacity: number,
  weight: (item: T) => number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let runningWeight = 0;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const schedule = () => {
      if (settled) return;
      while (next < items.length) {
        const item = items[next];
        const itemWeight = Math.min(capacity, Math.max(1, weight(item)));
        if (runningWeight > 0 && runningWeight + itemWeight > capacity) return;
        next += 1;
        runningWeight += itemWeight;
        void work(item)
          .catch((error: unknown) => {
            settled = true;
            reject(error);
          })
          .finally(() => {
            runningWeight -= itemWeight;
            if (next >= items.length && runningWeight === 0 && !settled) {
              resolve();
              return;
            }
            schedule();
          });
      }
      if (next >= items.length && runningWeight === 0) resolve();
    };
    schedule();
  });
}

async function reportItemFailure(
  apiBase: string,
  importId: string,
  itemKey: string,
  error: string,
): Promise<void> {
  await request(`${apiBase}/upload/strava/imports/${importId}/items/fail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ itemKey, error }),
  });
}

function activityType(value: string): string | undefined {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const aliases: Record<string, string> = {
    running: "run",
    cycling: "ride",
    biking: "ride",
    hiking: "hike",
    walking: "walk",
    swimming: "swim",
    roller_skiing: "roller_ski",
    nordic_skiing: "cross_country_ski",
    alpine_skiing: "alpine_ski",
    mountain_biking: "mountain_bike_ride",
    e_biking: "e_bike_ride",
    trail_running: "trail_run",
  };
  return (
    aliases[normalized] ??
    (KNOWN_ACTIVITY_TYPES.has(normalized) ? normalized : "other")
  );
}

const KNOWN_ACTIVITY_TYPES = new Set([
  "alpine_ski",
  "backcountry_ski",
  "badminton",
  "basketball",
  "canoeing",
  "cricket",
  "cross_country_ski",
  "crossfit",
  "dance",
  "e_bike_ride",
  "elliptical",
  "e_mountain_bike_ride",
  "golf",
  "gravel_ride",
  "handcycle",
  "high_intensity_interval_training",
  "hike",
  "ice_skate",
  "inline_skate",
  "kayaking",
  "kitesurf",
  "mountain_bike_ride",
  "padel",
  "physical_therapy",
  "pickleball",
  "pilates",
  "racquetball",
  "ride",
  "rock_climbing",
  "roller_ski",
  "rowing",
  "run",
  "sail",
  "skateboard",
  "snowboard",
  "snowshoe",
  "soccer",
  "squash",
  "stair_stepper",
  "stand_up_paddling",
  "surfing",
  "swim",
  "table_tennis",
  "tennis",
  "trail_run",
  "velomobile",
  "virtual_ride",
  "virtual_row",
  "virtual_run",
  "volleyball",
  "walk",
  "weight_training",
  "wheelchair",
  "windsurf",
  "workout",
  "yoga",
  "other",
]);

const extension = (name: string): string =>
  `.${name.split(".").at(-1)?.toLowerCase() ?? ""}`;
const assertNotCancelled = () => {
  if (cancelled) throw new Error("Import cancelled");
};
const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
const post = (type: string, value: object) =>
  self.postMessage({ type, ...value });
