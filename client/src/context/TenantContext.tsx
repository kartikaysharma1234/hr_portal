import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { setTenantSubdomain } from '../api/http';
import { resolveTenantSubdomain } from '../utils/tenant';

interface TenantContextValue {
  subdomain: string | null;
  rootDomain: string;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const TenantProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const rootDomain = import.meta.env.VITE_ROOT_DOMAIN ?? 'localhost';

  const [subdomain] = useState<string | null>(() => {
    return resolveTenantSubdomain(
      window.location.hostname,
      rootDomain,
      import.meta.env.VITE_TENANT_SUBDOMAIN
    );
  });

  useEffect(() => {
    setTenantSubdomain(subdomain);
  }, [subdomain]);

  const value = useMemo(
    () => ({
      subdomain,
      rootDomain
    }),
    [subdomain, rootDomain]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used inside TenantProvider');
  }

  return context;
};
