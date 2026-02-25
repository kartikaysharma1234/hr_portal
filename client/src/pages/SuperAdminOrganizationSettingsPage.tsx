import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { platformApi } from '../api/platformApi';
import { setAccessToken } from '../api/http';
import type { OrganizationSettings, OrganizationSettingsResponse } from '../types/platform';
import { getApiErrorMessage } from '../utils/apiError';
import { getPlatformToken } from '../utils/platformSession';

interface FlatField {
  path: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'array' | 'unknown';
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toLabel = (path: string): string => {
  const parts = path.split('.');
  const lastPart = parts[parts.length - 1] ?? path;
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char: string) => char.toUpperCase())
    .trim();
};

const flattenSection = (section: Record<string, unknown>, prefix = ''): FlatField[] => {
  const output: FlatField[] = [];

  for (const [key, rawValue] of Object.entries(section)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isRecord(rawValue)) {
      output.push(...flattenSection(rawValue, path));
      continue;
    }

    if (Array.isArray(rawValue)) {
      output.push({ path, value: rawValue, type: 'array' });
      continue;
    }

    switch (typeof rawValue) {
      case 'boolean':
        output.push({ path, value: rawValue, type: 'boolean' });
        break;
      case 'number':
        output.push({ path, value: rawValue, type: 'number' });
        break;
      case 'string':
        output.push({ path, value: rawValue, type: 'string' });
        break;
      default:
        output.push({ path, value: rawValue, type: 'unknown' });
    }
  }

  return output;
};

const setValueByPath = (
  section: Record<string, unknown>,
  path: string,
  nextValue: unknown
): Record<string, unknown> => {
  const clone = structuredClone(section);
  const keys = path.split('.');

  let cursor: Record<string, unknown> = clone;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const next = cursor[key];
    if (!isRecord(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[keys[keys.length - 1]] = nextValue;
  return clone;
};

export const SuperAdminOrganizationSettingsPage = (): JSX.Element => {
  const token = useMemo(() => getPlatformToken(), []);
  const { id } = useParams();

  const [organization, setOrganization] = useState<OrganizationSettingsResponse | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings>({});
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) {
      return;
    }

    setAccessToken(token);

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await platformApi.getOrganizationSettings(id);
        setOrganization(response);
        setSettings(response.settings ?? {});
        const firstSection = Object.keys(response.settings ?? {})[0] ?? '';
        setSelectedSection(firstSection);
      } catch (err) {
        setError(getApiErrorMessage(err, 'Unable to load organization settings'));
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [id, token]);

  if (!token) {
    return <Navigate to="/super-admin/login" replace />;
  }

  if (!id) {
    return <Navigate to="/super-admin" replace />;
  }

  const sectionKeys = Object.keys(settings);
  const activeSectionValue = isRecord(settings[selectedSection]) ? settings[selectedSection] : {};
  const activeSection = activeSectionValue as Record<string, unknown>;

  const fields = flattenSection(activeSection)
    .filter((field) => field.path.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => left.path.localeCompare(right.path));

  const updateField = (path: string, value: unknown): void => {
    setSettings((prev) => {
      const currentSectionValue = isRecord(prev[selectedSection]) ? prev[selectedSection] : {};
      const nextSection = setValueByPath(currentSectionValue as Record<string, unknown>, path, value);
      return {
        ...prev,
        [selectedSection]: nextSection
      };
    });
  };

  const saveSection = async (): Promise<void> => {
    if (!selectedSection) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await platformApi.updateOrganizationSettings(id, {
        [selectedSection]: settings[selectedSection]
      });
      setSuccess(`Saved "${selectedSection}" settings.`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save settings'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="sa-settings-shell">
      <header className="sa-settings-topbar">
        <div>
          <Link to="/super-admin" className="sa-settings-back-link">
            ← Back to Control Panel
          </Link>
          <h1>{organization?.name ?? 'Organization'} Settings</h1>
          <p>{organization?.subdomain}.localhost</p>
        </div>
      </header>

      {isLoading ? <p className="sa-settings-muted">Loading settings...</p> : null}

      {!isLoading ? (
        <section className="sa-settings-layout">
          <aside className="sa-settings-sections">
            <h3>Sections</h3>
            <div>
              {sectionKeys.map((sectionKey) => (
                <button
                  key={sectionKey}
                  type="button"
                  className={sectionKey === selectedSection ? 'active' : ''}
                  onClick={() => {
                    setSelectedSection(sectionKey);
                    setSearch('');
                    setSuccess(null);
                    setError(null);
                  }}
                >
                  {toLabel(sectionKey)}
                </button>
              ))}
            </div>
          </aside>

          <article className="sa-settings-editor">
            <header>
              <div>
                <h2>{toLabel(selectedSection)}</h2>
                <p>Edit and save this section for the selected organization.</p>
              </div>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search setting..."
              />
            </header>

            {error ? <div className="error-text">{error}</div> : null}
            {success ? <div className="success-text">{success}</div> : null}

            <div className="sa-settings-fields">
              {fields.map((field) => (
                <div key={field.path} className="sa-settings-field">
                  <label>{toLabel(field.path)}</label>

                  {field.type === 'boolean' ? (
                    <select
                      value={String(Boolean(field.value))}
                      onChange={(event) => updateField(field.path, event.target.value === 'true')}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : null}

                  {field.type === 'number' ? (
                    <input
                      type="number"
                      value={Number(field.value)}
                      onChange={(event) => updateField(field.path, Number(event.target.value))}
                    />
                  ) : null}

                  {field.type === 'string' ? (
                    <input
                      type="text"
                      value={String(field.value ?? '')}
                      onChange={(event) => updateField(field.path, event.target.value)}
                    />
                  ) : null}

                  {field.type === 'array' ? (
                    <textarea
                      rows={2}
                      value={(field.value as unknown[]).map((item) => String(item)).join(', ')}
                      onChange={(event) => {
                        const nextArray = event.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean);
                        updateField(field.path, nextArray);
                      }}
                    />
                  ) : null}

                  {field.type === 'unknown' ? <code>{JSON.stringify(field.value)}</code> : null}
                </div>
              ))}

              {fields.length === 0 ? (
                <p className="sa-settings-muted">No fields found for this section.</p>
              ) : null}
            </div>

            <footer>
              <button type="button" onClick={() => void saveSection()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Section'}
              </button>
            </footer>
          </article>
        </section>
      ) : null}
    </main>
  );
};
