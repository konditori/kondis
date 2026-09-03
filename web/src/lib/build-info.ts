import { env } from "$env/dynamic/public";
import rootPackage from "../../../package.json";

const version = env.PUBLIC_KONDIS_VERSION?.trim() || rootPackage.version;
const commit = env.PUBLIC_KONDIS_COMMIT?.trim() || "";
const branch = env.PUBLIC_KONDIS_BRANCH?.trim() || "";

export const buildInfo = {
  version,
  commit,
  branch,
  revision: [branch, commit].filter(Boolean).join(" · "),
};
