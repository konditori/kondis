export type RequestClientContext = {
  env?: { incoming?: { socket?: { remoteAddress?: string } } };
  req: { header: (name: string) => string | undefined };
};

export const requestClientId = (context: RequestClientContext, trustProxyHeaders: boolean): string => {
  const socketAddress = context.env?.incoming?.socket?.remoteAddress;
  const forwardedFor = context.req.header('X-Forwarded-For')?.split(',', 1)[0]?.trim();
  const candidate = trustProxyHeaders
    ? context.req.header('CF-Connecting-IP') || forwardedFor || socketAddress
    : socketAddress;
  return candidate && candidate.length <= 64 && /^[\da-f.:]+$/i.test(candidate) ? candidate : 'unknown';
};
