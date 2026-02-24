export const stripPort = (host: string): string => {
  return host.split(':')[0].toLowerCase();
};

export const extractSubdomain = (host: string, rootDomain: string): string | null => {
  const normalizedHost = stripPort(host);
  const normalizedRoot = rootDomain.toLowerCase();

  if (normalizedHost === normalizedRoot) {
    return null;
  }

  const hostParts = normalizedHost.split('.').filter(Boolean);
  const rootParts = normalizedRoot.split('.').filter(Boolean);

  if (hostParts.length <= rootParts.length) {
    return null;
  }

  const hostSuffix = hostParts.slice(-rootParts.length).join('.');
  if (hostSuffix !== normalizedRoot) {
    return null;
  }

  return hostParts[0] ?? null;
};
