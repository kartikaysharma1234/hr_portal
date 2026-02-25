export interface LocationPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive?: boolean;
}

export interface NearestLocationResult {
  location: LocationPoint | null;
  distanceMeters: number | null;
}

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value: number): number => (value * Math.PI) / 180;

export const haversineDistanceMeters = (
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
): number => {
  const dLat = toRadians(toLatitude - fromLatitude);
  const dLon = toRadians(toLongitude - fromLongitude);

  const lat1 = toRadians(fromLatitude);
  const lat2 = toRadians(toLatitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

export const isPointWithinRadius = (
  fromLatitude: number,
  fromLongitude: number,
  centerLatitude: number,
  centerLongitude: number,
  radiusMeters: number
): boolean => {
  const distance = haversineDistanceMeters(
    fromLatitude,
    fromLongitude,
    centerLatitude,
    centerLongitude
  );

  return distance <= radiusMeters;
};

export const findNearestLocation = (
  latitude: number,
  longitude: number,
  locations: LocationPoint[]
): NearestLocationResult => {
  if (!locations.length) {
    return {
      location: null,
      distanceMeters: null
    };
  }

  let nearest: LocationPoint | null = null;
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (const location of locations) {
    if (location.isActive === false) {
      continue;
    }

    const distance = haversineDistanceMeters(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearest = location;
    }
  }

  if (!nearest) {
    return {
      location: null,
      distanceMeters: null
    };
  }

  return {
    location: nearest,
    distanceMeters: shortestDistance
  };
};

export const validateGpsAccuracy = (
  accuracyMeters: number,
  maxAllowedMeters: number
): { isValid: boolean; message: string } => {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return {
      isValid: false,
      message: 'GPS accuracy is missing or invalid'
    };
  }

  if (accuracyMeters > maxAllowedMeters) {
    return {
      isValid: false,
      message: `GPS accuracy ${accuracyMeters.toFixed(1)}m is above allowed ${maxAllowedMeters}m`
    };
  }

  return {
    isValid: true,
    message: 'GPS accuracy is valid'
  };
};

export const formatLocationForDisplay = (latitude: number, longitude: number): string => {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'hrms-attendance-service/1.0'
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { display_name?: string };
    return payload.display_name ?? null;
  } catch {
    return null;
  }
};
