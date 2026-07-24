/**
 * Kondis API
 * 0.0.0
 * DO NOT MODIFY - This file has been generated using oazapfts.
 * See https://www.npmjs.com/package/oazapfts
 */
import * as Oazapfts from "@oazapfts/runtime";
import * as QS from "@oazapfts/runtime/query";
export const defaults: Oazapfts.Defaults<Oazapfts.CustomHeaders> = {
    headers: {},
    baseUrl: "/"
};
const oazapfts = Oazapfts.runtime(defaults);
export const servers = {};
export type PingResponseDtoOutput = {
    /** Health status of the API */
    status: string;
};
export type FitUploadResponseDtoOutput = {
    /** Stored file name */
    fileName: string;
    /** Stored file size in bytes */
    byteSize: number;
    /** Absolute path to the stored file */
    path: string;
};
/**
 * Health check endpoint
 */
export function serverControllerPing(opts?: Oazapfts.RequestOpts) {
    return oazapfts.ok(oazapfts.fetchJson<{
        status: 200;
        data: PingResponseDtoOutput;
    }>("/ping", {
        ...opts
    }));
}
/**
 * Upload a FIT activity file
 */
export function importControllerUploadFit({ body }: {
    body: {
        /** .fit activity file */
        file: Blob;
    };
}, opts?: Oazapfts.RequestOpts) {
    return oazapfts.ok(oazapfts.fetchJson<{
        status: 201;
        data: FitUploadResponseDtoOutput;
    }>("/uploads/fit", oazapfts.multipart({
        ...opts,
        method: "POST",
        body
    })));
}
