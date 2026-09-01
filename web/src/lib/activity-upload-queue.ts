const SUPPORTED_ACTIVITY_EXTENSIONS = [".fit", ".tcx", ".gpx"];

export type ActivityUploadStatus =
  "queued" | "uploading" | "done" | "skipped" | "error";

export type ActivityUploadItem = {
  file: File;
  status: ActivityUploadStatus;
  activity?: Pick<import("$lib/types").Activity, "id" | "name" | "sport">;
};

export function selectActivityFiles(files: File[]) {
  const acceptedFiles = files.filter((file) =>
    SUPPORTED_ACTIVITY_EXTENSIONS.some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    ),
  );

  return {
    files: acceptedFiles.map(
      (file) => ({ file, status: "queued" }) as ActivityUploadItem,
    ),
    hasRejectedFiles: acceptedFiles.length !== files.length,
  };
}

export async function uploadActivityFiles(
  files: ActivityUploadItem[],
  upload: (file: File) => Promise<void>,
): Promise<{ completedCount: number; failedCount: number }> {
  const pendingFiles = files.filter(
    (item) => item.status !== "done" && item.status !== "skipped",
  );

  await Promise.all(
    pendingFiles.map(async (item) => {
      item.status = "uploading";
      try {
        await upload(item.file);
        item.status = "done";
      } catch {
        item.status = "error";
      }
    }),
  );

  return {
    completedCount: files.filter(
      (item) => item.status === "done" || item.status === "skipped",
    ).length,
    failedCount: files.filter((item) => item.status === "error").length,
  };
}
