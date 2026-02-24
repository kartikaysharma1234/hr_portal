import { useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { getApiErrorMessage } from '../utils/apiError';

export const ResetPasswordPage = (): JSX.Element => {
  const { subdomain } = useTenant();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (!token) {
      setError('Reset token missing from URL');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authApi.resetPassword(token, newPassword);
      setSuccess(response.message);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to reset password'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Reset Password</h1>
        <p>Create your new password.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="reset-password">New Password</label>
          <input
            id="reset-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />

          <label htmlFor="reset-confirm-password">Confirm New Password</label>
          <input
            id="reset-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error ? <div className="error-text">{error}</div> : null}
          {success ? <div className="success-text">{success}</div> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p className="auth-footer-link">
          <Link to="/login">Back to login</Link>
        </p>
      </section>
    </main>
  );
};
