import { useEffect, useMemo, useState } from 'react';

import { attendanceApi } from '../../api/attendanceApi';
import type { AttendanceLocationPayload, AttendanceSettingsRecord } from '../../types/attendance';

const defaultLocationForm: AttendanceLocationPayload = {
  name: '',
  addressLine1: '',
  latitude: 0,
  longitude: 0,
  geofenceRadiusMeters: 150
};

export const AttendanceSettingsPanel = (): JSX.Element => {
  const [settingsList, setSettingsList] = useState<AttendanceSettingsRecord[]>([]);
  const [selectedSettingsId, setSelectedSettingsId] = useState<string>('');
  const [draft, setDraft] = useState<AttendanceSettingsRecord | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [locationForm, setLocationForm] = useState<AttendanceLocationPayload>(defaultLocationForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeSettings = useMemo(() => {
    if (!draft) {
      return null;
    }

    return draft;
  }, [draft]);

  const load = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const [settings, officeLocations] = await Promise.all([
        attendanceApi.getSettings(),
        attendanceApi.getOfficeLocations()
      ]);

      setSettingsList(settings);
      setLocations(officeLocations);

      const companySettings = settings.find((item) => item.scopeType === 'company') ?? settings[0] ?? null;
      setSelectedSettingsId(companySettings?._id ?? '');
      setDraft(companySettings ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load attendance settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const matched = settingsList.find((item) => item._id === selectedSettingsId) ?? null;
    setDraft(matched);
  }, [selectedSettingsId, settingsList]);

  const updateDraft = <K extends keyof AttendanceSettingsRecord>(key: K, value: AttendanceSettingsRecord[K]): void => {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        [key]: value
      };
    });
  };

  const saveSettings = async (): Promise<void> => {
    if (!draft) {
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await attendanceApi.updateSettings(draft._id, draft);
      setSettingsList((previous) => previous.map((item) => (item._id === updated._id ? updated : item)));
      setMessage('Attendance settings saved successfully.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save attendance settings');
    } finally {
      setIsSaving(false);
    }
  };

  const createLocation = async (): Promise<void> => {
    setError('');

    try {
      const created = await attendanceApi.createOfficeLocation(locationForm);
      setLocations((previous) => [created, ...previous]);
      setLocationForm(defaultLocationForm);
      setMessage('Office location added.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create office location');
    }
  };

  const removeLocation = async (id: string): Promise<void> => {
    setError('');

    try {
      await attendanceApi.deleteOfficeLocation(id);
      setLocations((previous) => previous.filter((item) => item.id !== id && item._id !== id));
      setMessage('Office location removed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete office location');
    }
  };

  return (
    <section className="attendance-settings-card">
      <header className="attendance-settings-header">
        <h3>Attendance Configuration</h3>
        <p>Configure geofence, timing, device checks, selfie policy, and invalid handling.</p>
      </header>

      {isLoading ? <p className="attendance-muted">Loading settings...</p> : null}
      {message ? <p className="attendance-success">{message}</p> : null}
      {error ? <p className="attendance-error">{error}</p> : null}

      <div className="attendance-settings-grid">
        <aside>
          <label>
            Scope
            <select
              value={selectedSettingsId}
              onChange={(event) => setSelectedSettingsId(event.target.value)}
            >
              {settingsList.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.scopeType}:{item.scopeRef}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={() => void saveSettings()} disabled={!draft || isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>

          {activeSettings ? (
            <pre className="attendance-preview">{JSON.stringify(activeSettings, null, 2)}</pre>
          ) : null}
        </aside>

        <div className="attendance-settings-form">
          {draft ? (
            <>
              <div className="attendance-settings-section">
                <h4>Geofencing</h4>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.geofencing.enabled}
                    onChange={(event) =>
                      updateDraft('geofencing', {
                        ...draft.geofencing,
                        enabled: event.target.checked
                      })
                    }
                  />
                  Enable geofencing
                </label>

                <label>
                  Mode
                  <select
                    value={draft.geofencing.geofenceMode}
                    onChange={(event) =>
                      updateDraft('geofencing', {
                        ...draft.geofencing,
                        geofenceMode: event.target.value as 'strict' | 'flexible' | 'warning_only'
                      })
                    }
                  >
                    <option value="strict">Strict</option>
                    <option value="flexible">Flexible</option>
                    <option value="warning_only">Warning only</option>
                  </select>
                </label>

                <label>
                  Default Radius (m)
                  <input
                    type="number"
                    value={draft.geofencing.defaultRadiusMeters}
                    onChange={(event) =>
                      updateDraft('geofencing', {
                        ...draft.geofencing,
                        defaultRadiusMeters: Number(event.target.value)
                      })
                    }
                  />
                </label>

                <label>
                  Max GPS Accuracy (m)
                  <input
                    type="number"
                    value={draft.geofencing.maxGpsAccuracyMeters}
                    onChange={(event) =>
                      updateDraft('geofencing', {
                        ...draft.geofencing,
                        maxGpsAccuracyMeters: Number(event.target.value)
                      })
                    }
                  />
                </label>
              </div>

              <div className="attendance-settings-section">
                <h4>Timing Rules</h4>
                <label>
                  Timezone
                  <input
                    value={draft.timingRules.timezone}
                    onChange={(event) =>
                      updateDraft('timingRules', {
                        ...draft.timingRules,
                        timezone: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Shift Start
                  <input
                    value={draft.timingRules.shiftStartTime}
                    onChange={(event) =>
                      updateDraft('timingRules', {
                        ...draft.timingRules,
                        shiftStartTime: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Shift End
                  <input
                    value={draft.timingRules.shiftEndTime}
                    onChange={(event) =>
                      updateDraft('timingRules', {
                        ...draft.timingRules,
                        shiftEndTime: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Late Grace (min)
                  <input
                    type="number"
                    value={draft.timingRules.graceInMinutes}
                    onChange={(event) =>
                      updateDraft('timingRules', {
                        ...draft.timingRules,
                        graceInMinutes: Number(event.target.value)
                      })
                    }
                  />
                </label>

                <label>
                  Early Exit Grace (min)
                  <input
                    type="number"
                    value={draft.timingRules.graceOutMinutes}
                    onChange={(event) =>
                      updateDraft('timingRules', {
                        ...draft.timingRules,
                        graceOutMinutes: Number(event.target.value)
                      })
                    }
                  />
                </label>
              </div>

              <div className="attendance-settings-section">
                <h4>Device & Photo</h4>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.deviceValidation.enforceDeviceValidation}
                    onChange={(event) =>
                      updateDraft('deviceValidation', {
                        ...draft.deviceValidation,
                        enforceDeviceValidation: event.target.checked
                      })
                    }
                  />
                  Enforce device validation
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={draft.deviceValidation.requireRegisteredDevice}
                    onChange={(event) =>
                      updateDraft('deviceValidation', {
                        ...draft.deviceValidation,
                        requireRegisteredDevice: event.target.checked
                      })
                    }
                  />
                  Registered devices only
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={draft.photoRequirements.enabled}
                    onChange={(event) =>
                      updateDraft('photoRequirements', {
                        ...draft.photoRequirements,
                        enabled: event.target.checked
                      })
                    }
                  />
                  Enable selfie capture
                </label>

                <label>
                  Invalid Punch Mode
                  <select
                    value={draft.invalidPunchHandling.mode}
                    onChange={(event) =>
                      updateDraft('invalidPunchHandling', {
                        ...draft.invalidPunchHandling,
                        mode: event.target.value as 'block' | 'store' | 'warn' | 'pending_approval'
                      })
                    }
                  >
                    <option value="block">Block</option>
                    <option value="store">Store as Invalid</option>
                    <option value="warn">Store as Warning</option>
                    <option value="pending_approval">Pending Approval</option>
                  </select>
                </label>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="attendance-location-panel">
        <h4>Office Locations</h4>

        <div className="attendance-location-form">
          <input
            placeholder="Location name"
            value={locationForm.name}
            onChange={(event) =>
              setLocationForm((previous) => ({
                ...previous,
                name: event.target.value
              }))
            }
          />
          <input
            placeholder="Address"
            value={locationForm.addressLine1}
            onChange={(event) =>
              setLocationForm((previous) => ({
                ...previous,
                addressLine1: event.target.value
              }))
            }
          />
          <input
            placeholder="Latitude"
            type="number"
            value={locationForm.latitude}
            onChange={(event) =>
              setLocationForm((previous) => ({
                ...previous,
                latitude: Number(event.target.value)
              }))
            }
          />
          <input
            placeholder="Longitude"
            type="number"
            value={locationForm.longitude}
            onChange={(event) =>
              setLocationForm((previous) => ({
                ...previous,
                longitude: Number(event.target.value)
              }))
            }
          />
          <input
            placeholder="Radius (m)"
            type="number"
            value={locationForm.geofenceRadiusMeters}
            onChange={(event) =>
              setLocationForm((previous) => ({
                ...previous,
                geofenceRadiusMeters: Number(event.target.value)
              }))
            }
          />
          <button type="button" onClick={() => void createLocation()}>
            Add Location
          </button>
        </div>

        <div className="attendance-location-list">
          {locations.map((location) => {
            const id = location.id ?? location._id;
            return (
              <article key={id}>
                <div>
                  <strong>{location.name}</strong>
                  <p>
                    {location.addressLine1} ({location.latitude?.toFixed?.(5) ?? '--'},{' '}
                    {location.longitude?.toFixed?.(5) ?? '--'})
                  </p>
                </div>
                <button type="button" onClick={() => void removeLocation(id)}>
                  Delete
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
