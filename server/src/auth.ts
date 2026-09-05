export type AuthenticatedUser = {
  id: string;
  role: 'admin' | 'user';
  email: string;
  firstName: string;
  lastName: string;
};

export type AccessTokenHeaders = {
  authorization?: string;
  cookie?: string;
  kondisAuthorization?: string;
};

export const getAccessToken = (headers: AccessTokenHeaders): string | undefined => {
  const kondisHeaderToken = headers.kondisAuthorization?.startsWith('Bearer ')
    ? headers.kondisAuthorization.slice(7)
    : undefined;
  const bearerToken = headers.authorization?.startsWith('Bearer ') ? headers.authorization.slice(7) : undefined;
  const cookieToken = headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('kondis_session='))
    ?.slice('kondis_session='.length);
  return kondisHeaderToken ?? bearerToken ?? cookieToken;
};
