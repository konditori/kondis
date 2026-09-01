import { describe, expect, it, vi } from "vitest";

import {
  selectActivityFiles,
  uploadActivityFiles,
  type ActivityUploadItem,
} from "$lib/activity-upload-queue";

const makeFile = (name: string) => new File(["activity"], name);

describe("selectActivityFiles", () => {
  it("accepts every supported activity type, regardless of extension casing", () => {
    const selection = selectActivityFiles([
      makeFile("run.FIT"),
      makeFile("ride.tcx"),
      makeFile("walk.GpX"),
    ]);

    expect(selection.hasRejectedFiles).toBe(false);
    expect(selection.files).toEqual([
      { file: expect.objectContaining({ name: "run.FIT" }), status: "queued" },
      { file: expect.objectContaining({ name: "ride.tcx" }), status: "queued" },
      { file: expect.objectContaining({ name: "walk.GpX" }), status: "queued" },
    ]);
  });

  it("keeps valid files but reports when a selection includes unsupported files", () => {
    const selection = selectActivityFiles([
      makeFile("run.fit"),
      makeFile("notes.txt"),
    ]);

    expect(selection.hasRejectedFiles).toBe(true);
    expect(selection.files).toHaveLength(1);
    expect(selection.files[0].file.name).toBe("run.fit");
  });
});

describe("uploadActivityFiles", () => {
  it("uploads every queued file and preserves each individual result", async () => {
    const items: ActivityUploadItem[] = [
      { file: makeFile("one.fit"), status: "queued" },
      { file: makeFile("two.gpx"), status: "queued" },
      { file: makeFile("three.tcx"), status: "queued" },
    ];
    const upload = vi.fn(async (file: File) => {
      if (file.name === "two.gpx") throw new Error("network failure");
    });

    await expect(uploadActivityFiles(items, upload)).resolves.toEqual({
      completedCount: 2,
      failedCount: 1,
    });

    expect(upload).toHaveBeenCalledTimes(3);
    expect(items.map((item) => item.status)).toEqual(["done", "error", "done"]);
  });

  it("marks a file as uploading until its request settles", async () => {
    const item: ActivityUploadItem = {
      file: makeFile("run.fit"),
      status: "queued",
    };
    let finishUpload: (() => void) | undefined;
    const upload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUpload = resolve;
        }),
    );

    const result = uploadActivityFiles([item], upload);

    expect(item.status).toBe("uploading");
    finishUpload?.();
    await expect(result).resolves.toEqual({
      completedCount: 1,
      failedCount: 0,
    });
    expect(item.status).toBe("done");
  });

  it("retries failed files without re-uploading completed files", async () => {
    const completed = {
      file: makeFile("completed.fit"),
      status: "done",
    } as const;
    const failed = {
      file: makeFile("failed.fit"),
      status: "error",
    } as ActivityUploadItem;
    const upload = vi.fn(async () => {});

    await expect(
      uploadActivityFiles([completed, failed], upload),
    ).resolves.toEqual({
      completedCount: 2,
      failedCount: 0,
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(failed.file);
    expect(failed.status).toBe("done");
  });
});
