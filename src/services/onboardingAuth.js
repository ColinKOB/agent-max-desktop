export const AUTH_CALLBACK_URL = 'agentmax://auth/callback';

export async function createOnboardingAccount(auth, email, password) {
  return auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: AUTH_CALLBACK_URL },
  });
}

export async function exchangeOnboardingCallback(auth, rawUrl) {
  const callbackUrl = new URL(rawUrl);
  if (callbackUrl.protocol !== 'agentmax:' || callbackUrl.hostname !== 'auth' || callbackUrl.pathname !== '/callback') {
    throw new Error('Invalid authentication callback.');
  }

  const code = callbackUrl.searchParams.get('code');
  if (code) return auth.exchangeCodeForSession(code);

  const fragment = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    return auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }
  throw new Error('Authentication callback did not contain a session.');
}
