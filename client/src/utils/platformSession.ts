const platformTokenStorageKey = 'hrms:platform:token';

export const getPlatformToken = (): string | null => {
  return localStorage.getItem(platformTokenStorageKey);
};

export const setPlatformToken = (token: string): void => {
  localStorage.setItem(platformTokenStorageKey, token);
};

export const clearPlatformToken = (): void => {
  localStorage.removeItem(platformTokenStorageKey);
};
