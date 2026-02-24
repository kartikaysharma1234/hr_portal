import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { getApiErrorMessage } from '../utils/apiError';

export const VerifyEmailPage = (): JSX.Element => {
  const { subdomain } = useTenant();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const [message, setMessage] = useState('Verifying your email...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verify = async (): Promise<void> => {
      if (!token) {
        if (isMounted) {
          setIsError(true);
          setMessage('Verification token missing');
        }
        return;
      }

      try {
        const response = await authApi.verifyEmail(token);
        if (isMounted) {
          setIsError(false);
          setMessage(response.message);
        }
      } catch (err) {
        if (isMounted) {
          setIsError(true);
          setMessage(getApiErrorMessage(err, 'Verification failed'));
        }
      }
    };

    void verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (!subdomain) {
    return <Navigate to="/tenant-not-found" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Email Verification</h1>
        <p className={isError ? 'error-text' : 'success-text'}>{message}</p>
        <p className="auth-footer-link">
          <Link to="/login">Go to login</Link>
        </p>
      </section>
    </main>
  );
};
