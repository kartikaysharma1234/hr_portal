import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { getApiErrorMessage } from '../utils/apiError';

export const RegisterPage = (): JSX.Element => {
  const { subdomain } = useTenant();
  const { isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authApi.register({ name, email, password });
      setSuccess(response.message);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to register user'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Create Account</h1>
        <p>Register as a new employee in this company portal.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="register-name">Full Name</label>
          <input
            id="register-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <label htmlFor="register-confirm-password">Confirm Password</label>
          <input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error ? <div className="error-text">{error}</div> : null}
          {success ? <div className="success-text">{success}</div> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer-link">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
};
