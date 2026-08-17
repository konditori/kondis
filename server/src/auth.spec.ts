import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAccessToken, createActivityEventsTicket, verifyActivityEventsTicket } from 'src/auth';

const SECRET = 'test-secret';

describe('activity event tickets', () => {
  afterEach(() => vi.useRealTimers());

  it('accepts a current ticket and returns only its authenticated user id', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));

    const ticket = createActivityEventsTicket('8300a315-5101-4bbf-8813-6244965ed9b5', SECRET);

    expect(verifyActivityEventsTicket(ticket.token, SECRET)).toBe('8300a315-5101-4bbf-8813-6244965ed9b5');
  });

  it('rejects expired, altered, and normal access tokens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    const ticket = createActivityEventsTicket('8300a315-5101-4bbf-8813-6244965ed9b5', SECRET);
    const accessToken = createAccessToken(
      { id: '8300a315-5101-4bbf-8813-6244965ed9b5', role: 'user', email: 'a@example.com', name: 'A' },
      SECRET,
    );

    expect(verifyActivityEventsTicket(`${ticket.token}x`, SECRET)).toBeUndefined();
    expect(verifyActivityEventsTicket(accessToken, SECRET)).toBeUndefined();
    vi.advanceTimersByTime(60_001);
    expect(verifyActivityEventsTicket(ticket.token, SECRET)).toBeUndefined();
  });
});
