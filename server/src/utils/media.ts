export const publicMediaUrl = (baseUrl: string | undefined, path: string, fallback: string): string => {
  if (!baseUrl) {
    return fallback;
  }
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};
