export const normalizeHostname = (hostname: string): string => {
  return hostname.toLowerCase().split(':')[0];
};

export const extractSubdomain = (hostname: string, rootDomain: string): string | null => {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedRoot = rootDomain.toLowerCase();

  if (normalizedHost === normalizedRoot) {
    return null;
  }

  const hostParts = normalizedHost.split('.').filter(Boolean);
  const rootParts = normalizedRoot.split('.').filter(Boolean);

  if (hostParts.length <= rootParts.length) {
    return null;
  }

  const suffix = hostParts.slice(-rootParts.length).join('.');
  if (suffix !== normalizedRoot) {
    return null;
  }

  return hostParts[0] ?? null;
};

export const resolveTenantSubdomain = (
  hostname: string,
  rootDomain: string,
  manualTenant?: string
): string | null => {
  const fromEnv = manualTenant?.trim().toLowerCase();
  if (fromEnv) {
    return fromEnv;
  }

  return extractSubdomain(hostname, rootDomain);
};
