import { describe, expect, it } from 'vitest';

import { getAccessToken } from 'src/auth';

describe(getAccessToken.name, () => {
  it('reads the Kondis, bearer, and cookie transports in precedence order', () => {
    expect(
      getAccessToken({
        kondisAuthorization: 'Bearer kondis',
        authorization: 'Bearer standard',
        cookie: 'other=value; kondis_session=cookie',
      }),
    ).toBe('kondis');
    expect(getAccessToken({ authorization: 'Bearer standard', cookie: 'kondis_session=cookie' })).toBe('standard');
    expect(getAccessToken({ cookie: 'other=value; kondis_session=cookie' })).toBe('cookie');
  });

  it('rejects missing and malformed transports', () => {
    expect(getAccessToken({})).toBeUndefined();
    expect(getAccessToken({ authorization: 'Basic value' })).toBeUndefined();
  });
});
