import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js";
import { describe, expect, it } from "vitest";

import { decodeCsvText, validateZipEntries } from "./strava-takeout.worker";

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
});
