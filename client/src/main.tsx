import { GoogleOAuthProvider } from '@react-oauth/google';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import './styles/global.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const RootProviders = ({ children }: { children: React.ReactNode }): JSX.Element => {
  if (!googleClientId) {
    return <>{children}</>;
  }

  return <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootProviders>
      <TenantProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </TenantProvider>
    </RootProviders>
  </React.StrictMode>
);
