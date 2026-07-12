import { describe, expect, it, vi } from 'vitest';
import {
  AUTH_CALLBACK_URL,
  createOnboardingAccount,
  exchangeOnboardingCallback,
} from '../../../services/onboardingAuth.js';

describe('onboarding authentication contract', () => {
  it('creates an account directly without probing sign-in', async () => {
    const auth = { signUp: vi.fn().mockResolvedValue({ data: {}, error: null }) };
    await createOnboardingAccount(auth, ' new@example.com ', 'secure-password');
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secure-password',
      options: { emailRedirectTo: AUTH_CALLBACK_URL },
    });
  });

  it('exchanges a PKCE callback code', async () => {
    const auth = { exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }) };
    await exchangeOnboardingCallback(auth, `${AUTH_CALLBACK_URL}?code=verification-code`);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('verification-code');
  });

  it('accepts an implicit callback session and rejects unrelated protocols', async () => {
    const auth = { setSession: vi.fn().mockResolvedValue({ error: null }) };
    await exchangeOnboardingCallback(auth, `${AUTH_CALLBACK_URL}#access_token=access&refresh_token=refresh`);
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
    await expect(exchangeOnboardingCallback(auth, 'https://example.com/callback?code=bad')).rejects.toThrow('Invalid authentication callback');
  });
});
