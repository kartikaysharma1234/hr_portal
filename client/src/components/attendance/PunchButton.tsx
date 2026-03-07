import { useMemo, useRef, useState } from 'react';

import { attendanceApi } from '../../api/attendanceApi';
import { getApiErrorMessage } from '../../utils/apiError';

interface PunchButtonProps {
  type: 'IN' | 'OUT';
  selfieRequired?: boolean;
  source?: 'mobile_app' | 'web';
  onSuccess?: () => void;
}

const toBase64DataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const buildDeviceInfo = (): {
  deviceId: string;
  userAgent: string;
  platform: string;
} => {
  const cachedKey = 'hrms.device-id';
  let deviceId = localStorage.getItem(cachedKey);
  if (!deviceId) {
    const random = Math.random().toString(36).slice(2);
    deviceId = `web-${Date.now()}-${random}`;
    localStorage.setItem(cachedKey, deviceId);
  }

  return {
    deviceId,
    userAgent: navigator.userAgent,
    platform: navigator.platform
  };
};

const getCurrentLocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
};

export const PunchButton = ({
  type,
  selfieRequired = false,
  source = 'web',
  onSuccess
}: PunchButtonProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusColor, setStatusColor] = useState<string | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<string>('');
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const buttonLabel = useMemo(() => (type === 'IN' ? 'Punch In' : 'Punch Out'), [type]);

  const handlePunch = async (): Promise<void> => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (selfieRequired && !selfieFile) {
        throw new Error('Selfie is required before punching.');
      }

      const geo = await getCurrentLocation();
      const coords = geo.coords;

      const photoPayload = selfieFile
        ? {
            url: await toBase64DataUrl(selfieFile),
            mimeType: selfieFile.type,
            sizeBytes: selfieFile.size
          }
        : undefined;

      const payload = {
        timestamp: new Date().toISOString(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        source,
        device: {
          ...buildDeviceInfo(),
          ipAddress: '',
          appVersion: 'web-1.0.0'
        },
        photo: photoPayload
      };

      const response =
        type === 'IN' ? await attendanceApi.punchIn(payload) : await attendanceApi.punchOut(payload);

      setStatusColor(response.colorHex);
      setSuccess(
        `${buttonLabel} successful (${response.status.toUpperCase()})${
          response.workingHours ? ` • ${response.workingHours} hrs` : ''
        }`
      );

      const distanceReason = response.reasons.find((reason) => reason.code.includes('GEOFENCE'));
      setDistanceInfo(distanceReason?.message ?? `GPS accuracy ${Math.round(coords.accuracy)}m`);

      if (onSuccess) {
        onSuccess();
      }
    } catch (caught) {
      const message = getApiErrorMessage(
        caught,
        caught instanceof Error ? caught.message : 'Failed to punch attendance'
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="attendance-punch-card">
      <div className="attendance-punch-header">
        <h3>{buttonLabel}</h3>
        <span>{source === 'mobile_app' ? 'Mobile' : 'Web'}</span>
      </div>

      <p className="attendance-punch-subtext">
        Verify location and device before submitting attendance.
      </p>

      {selfieRequired && (
        <div className="attendance-selfie-block">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelfieFile(file);
            }}
          />
          <small>{selfieFile ? `Selected: ${selfieFile.name}` : 'Capture selfie before punch'}</small>
        </div>
      )}

      <button type="button" className="attendance-punch-btn" onClick={handlePunch} disabled={isLoading}>
        {isLoading ? 'Validating...' : buttonLabel}
      </button>

      {success ? (
        <p className="attendance-punch-success" style={statusColor ? { borderColor: statusColor } : undefined}>
          {success}
        </p>
      ) : null}

      {distanceInfo ? <p className="attendance-punch-distance">{distanceInfo}</p> : null}

      {error ? <p className="attendance-punch-error">{error}</p> : null}
    </div>
  );
};

