import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { getApiErrorMessage } from '../utils/apiError';

export const ForgotPasswordPage = (): JSX.Element => {
  const { subdomain } = useTenant();
  const { isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!subdomain) {
    return <Navigate to="/tenant-not-found" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await authApi.forgotPassword(email);
      setSuccess(response.message);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to process request'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Forgot Password</h1>
        <p>Enter your email. If valid, you will receive a reset link.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {error ? <div className="error-text">{error}</div> : null}
          {success ? <div className="success-text">{success}</div> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="auth-footer-link">
          <Link to="/login">Back to login</Link>
        </p>
      </section>
    </main>
  );
};
