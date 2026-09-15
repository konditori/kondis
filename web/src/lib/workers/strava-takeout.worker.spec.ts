import {
  BlobReader,
  BlobWriter,
  TextReader,
  Uint8ArrayReader,
  ZipReader,
  ZipWriter,
  type FileEntry,
} from "@zip.js/zip.js";
import { describe, expect, it } from "vitest";

import {
  decodeCsvText,
  gunzipEntry,
  parseCsv,
  scanActivities,
  validateZipEntries,
} from "./strava-takeout.worker";

const makeZip = async (
  files: Record<string, string>,
  zip64 = false,
): Promise<Blob> => {
  const writer = new ZipWriter(new BlobWriter("application/zip"), {
    zip64,
    useWebWorkers: false,
  });
  for (const [name, contents] of Object.entries(files))
    await writer.add(name, new TextReader(contents));
  return writer.close();
};

const readEntries = async (archive: Blob) => {
  const reader = new ZipReader(new BlobReader(archive), {
    strictness: "strict",
    checkCrc32: true,
  });
  try {
    return await reader.getEntries({
      strictness: "strict",
      filenameValidation: "strict",
    });
  } finally {
    await reader.close();
  }
};

describe("Strava takeout archive validation", () => {
  it("decodes UTF-8 names without replacement characters", () => {
    expect(decodeCsvText(new TextEncoder().encode("Hem från cupen"))).toBe(
      "Hem från cupen",
    );
  });

  it("rejects non-UTF-8 CSV bytes", () => {
    expect(() => decodeCsvText(Uint8Array.from([0x48, 0xe5, 0x6d]))).toThrow();
  });

  it("accepts a synthetic ZIP64 archive", async () => {
    const entries = await readEntries(
      await makeZip({ "activities.csv": "Filename\n" }, true),
    );

    expect(() => validateZipEntries(entries)).not.toThrow();
  });

  it("rejects a synthetic compressed bomb before extraction", async () => {
    const entries = await readEntries(
      await makeZip({
        "activities.csv": "Filename\n",
        "activities/bomb.gpx": "0".repeat(1_000_000),
      }),
    );

    expect(() => validateZipEntries(entries)).toThrow("compression ratio");
  });

  it("rejects a corrupt archive while reading its central directory", async () => {
    const archive = await makeZip({ "activities.csv": "Filename\n" });
    const corrupt = archive.slice(0, archive.size - 8);

    await expect(readEntries(corrupt)).rejects.toThrow();
  });

  it("rejects an entry whose stored payload fails its CRC32 check", async () => {
    const writer = new ZipWriter(new BlobWriter("application/zip"), {
      useWebWorkers: false,
    });
    await writer.add("activities/run.gpx", new TextReader("0123456789abcdef"), {
      level: 0,
    });
    const bytes = new Uint8Array(await (await writer.close()).arrayBuffer());
    // Corrupt one payload byte: local header PK\x03\x04, name length at 26, extra length at 28.
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const filenameLength = bytes[26] | (bytes[27] << 8);
    const extraLength = bytes[28] | (bytes[29] << 8);
    bytes[30 + filenameLength + extraLength] ^= 0xff;

    const entries = await readEntries(
      new Blob([bytes], { type: "application/zip" }),
    );
    const entry = entries.find(
      (candidate) => candidate.filename === "activities/run.gpx",
    ) as FileEntry;
    await expect(
      entry.getData(new BlobWriter(), { checkCrc32: true }),
    ).rejects.toThrow("Invalid CRC32");
  });

  it("rejects corrupt gzip data without leaking an unhandled rejection", async () => {
    // Node has no `self`; the worker checks it for DecompressionStream support.
    (globalThis as { self?: unknown }).self ??= globalThis;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const writer = new ZipWriter(new BlobWriter("application/zip"), {
        useWebWorkers: false,
      });
      await writer.add(
        "activities/bad.fit.gz",
        new Uint8ArrayReader(
          Uint8Array.from([
            0x1f, 0x8b, 0x08, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x02, 0x03, 0x63,
          ]),
        ),
      );
      const entries = await readEntries(await writer.close());
      const entry = entries.find(
        (candidate) => candidate.filename === "activities/bad.fit.gz",
      ) as FileEntry;

      await expect(gunzipEntry(entry)).rejects.toThrow();
      // Let any stray stream rejection settle before judging.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

describe("Strava CSV and activity metadata", () => {
  it("preserves quoted Unicode, commas, escaped quotes and line breaks", () => {
    expect(
      parseCsv('\uFEFFName,Description\r\n"Å, 走る","First\n""second"""\r\n'),
    ).toEqual([
      ["Name", "Description"],
      ["Å, 走る", 'First\n"second"'],
    ]);
    expect(() => parseCsv('Name\n"unfinished')).toThrow("unterminated");
  });

  it("uses the second Distance and preserves missing metrics versus zero", () => {
    const headers = [
      "Filename",
      "Activity ID",
      "Activity Date",
      "Activity Type",
      "Elapsed Time",
      "Distance",
      "Distance",
      "Moving Time",
      "Calories",
    ];
    const { items, extractionErrors } = scanActivities(
      [
        [
          "",
          "100",
          "2030-01-03T12:00:00Z",
          "Walk",
          "1800",
          "2.5",
          "2500",
          "0",
          "",
        ],
        ["", "101", "invalid date", "Walk", "100", "", "", "", ""],
        ["", "102", "2030-01-03T12:00:00Z", "Walk", "", "", "", "", ""],
        [""],
      ],
      headers,
      "",
      new Map(),
    );
    expect(extractionErrors).toBe(2);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "manual",
      sourceId: "100",
      sport: "walk",
      elapsedTime: 1800,
      distance: 2500,
      movingTime: 0,
      calories: null,
    });
  });

  it("associates ordered photos and captions with both file and manual activities, ignoring video", async () => {
    const entries = await readEntries(
      await makeZip({
        "export/activities/run.fit.gz": "placeholder",
        "export/media/a.png": "placeholder",
        "export/media/b.png": "placeholder",
      }),
    );
    const files = new Map(
      entries
        .filter((entry) => !entry.directory)
        .map((entry) => [entry.filename, entry]),
    );
    const { items, extractionErrors } = scanActivities(
      [
        [
          "activities/run.fit.gz",
          "Run",
          "yes",
          "media/a.png|media/a.png||media/video.mp4|media/b.png",
          "",
          "",
        ],
        ["", "Walk", "", "media/b.png", "2030-01-01T12:00:00Z", "600"],
      ],
      [
        "Filename",
        "Activity Type",
        "Commute",
        "Media",
        "Activity Date",
        "Elapsed Time",
      ],
      "export/",
      files,
      [
        ["Media Filename", "Media Caption"],
        ["media/a.png", "Caption, Å"],
        ["media/b.png", "Second"],
      ],
    );
    expect(extractionErrors).toBe(0);
    expect(items[0]).toMatchObject({
      kind: "activity",
      originalName: "run.fit",
      gzip: true,
      tags: ["commute"],
      photos: [
        {
          entryName: "export/media/a.png",
          caption: "Caption, Å",
          sortOrder: 0,
        },
        { entryName: "export/media/b.png", caption: "Second", sortOrder: 1 },
      ],
    });
    expect(items[1]).toMatchObject({
      kind: "manual",
      photos: [
        { entryName: "export/media/b.png", caption: "Second", sortOrder: 0 },
      ],
    });
  });

  it("counts missing and repeated references, ignores unsupported files", async () => {
    const entries = await readEntries(
      await makeZip({ "activities/run.fit": "placeholder" }),
    );
    const files = new Map(
      entries
        .filter((entry) => !entry.directory)
        .map((entry) => [entry.filename, entry]),
    );
    const scan = scanActivities(
      [
        ["activities/run.fit", "media/missing.jpg"],
        ["activities/run.fit", ""],
        ["activities/missing.fit", ""],
        ["../unsafe.fit", ""],
        ["activities/unsupported.txt", ""],
      ],
      ["Filename", "Media"],
      "",
      files,
    );
    expect(scan.items).toHaveLength(1);
    expect(scan.extractionErrors).toBe(4);
  });
});

describe("Archive validation boundaries", () => {
  it.each([
    "../escape.fit",
    "/absolute.fit",
    "C:/drive.fit",
    "a\\b.fit",
    "a//b.fit",
  ])("rejects unsafe path %s", async (filename) => {
    const entries = await readEntries(await makeZip({ "safe.fit": "data" }));
    entries[0].filename = filename;
    expect(() => validateZipEntries(entries)).toThrow("unsafe");
  });

  it("rejects encrypted, duplicate, oversized and excessive entries before allocating payloads", async () => {
    const entries = await readEntries(await makeZip({ "safe.fit": "data" }));
    expect(() => validateZipEntries([...entries, ...entries])).toThrow(
      "duplicate",
    );
    expect(() =>
      validateZipEntries([{ ...entries[0], encrypted: true }]),
    ).toThrow("encrypted");
    expect(() =>
      validateZipEntries([
        { ...entries[0], uncompressedSize: 64 * 1024 * 1024 + 1 },
      ]),
    ).toThrow("64 MiB");
    expect(() =>
      validateZipEntries(Array.from({ length: 20_001 }, () => entries[0])),
    ).toThrow("too many entries");
  });
});
