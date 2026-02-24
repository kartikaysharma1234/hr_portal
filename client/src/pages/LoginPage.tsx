import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { getApiErrorMessage } from '../utils/apiError';

const isGoogleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export const LoginPage = (): JSX.Element => {
  const { subdomain } = useTenant();
  const { login, loginWithGoogle, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  if (!subdomain) {
    return <Navigate to="/tenant-not-found" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid credentials for this company subdomain'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onGoogleSuccess = async (credentialResponse: CredentialResponse): Promise<void> => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      setError('Google sign-in failed: missing token');
      return;
    }

    setError(null);
    setInfo(null);

    try {
      await loginWithGoogle(idToken);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Google sign-in failed'));
    }
  };

  const onResendVerification = async (): Promise<void> => {
    if (!email.trim()) {
      setError('Enter your email first to resend verification');
      return;
    }

    setError(null);
    setInfo(null);
    setIsResending(true);

    try {
      const response = await authApi.resendVerification(email.trim());
      setInfo(response.message);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to resend verification email'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="login-shell">
      <header className="login-header">
        <div className="brand">Quelstring HRMS</div>
        <div className="tenant-chip">{subdomain}.company-portal</div>
      </header>

      <section className="login-content">
        <div className="left-art" aria-hidden="true">
          <span className="dot dot-lg" />
          <span className="dot dot-sm" />
          <span className="dot dot-md" />
          <span className="dot dot-xl" />
          <span className="dot dot-md" />
          <span className="dot dot-lg" />
        </div>

        <div className="login-card-wrap">
          <h1>Welcome to Enterprise HRMS</h1>
          <p>Employee Self Service</p>

          <form className="login-card" onSubmit={onSubmit}>
            <label htmlFor="email">Employee Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="employee@company.com"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
            />

            {error ? <div className="error-text">{error}</div> : null}
            {info ? <div className="success-text">{info}</div> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>

            <div className="login-links">
              <Link to="/forgot-password">Forgot Password</Link>
              <button
                type="button"
                className="link-btn"
                onClick={onResendVerification}
                disabled={isResending}
              >
                {isResending ? 'Resending...' : 'Resend Verification'}
              </button>
            </div>

            <div className="login-links">
              <span>New user?</span>
              <Link to="/register">Create account</Link>
            </div>

            {isGoogleConfigured ? (
              <div className="google-login-wrap">
                <span>or</span>
                <GoogleLogin onSuccess={(cred) => void onGoogleSuccess(cred)} onError={() => setError('Google sign-in failed')} />
              </div>
            ) : (
              <div className="info-text">Google sign-in is not configured for this environment.</div>
            )}
          </form>
        </div>
      </section>
    </main>
  );
};
