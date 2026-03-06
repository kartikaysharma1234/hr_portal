import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { usersApi } from '../api/usersApi';
import { useAuth } from '../context/AuthContext';
import type { ManagedUserRole, OrganizationUserRow } from '../types/userManagement';
import { getApiErrorMessage } from '../utils/apiError';
import '../styles/org_users.css';

const roleOptions: ManagedUserRole[] = ['admin', 'hr', 'manager', 'employee'];

export const OrganizationUsersPage = (): JSX.Element => {
  const { user } = useAuth();
  const canManageUsers = user?.role === 'admin' || user?.role === 'super_admin';

  const [rows, setRows] = useState<OrganizationUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<ManagedUserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<'true' | 'false' | ''>('');
  const [savingRoleByUserId, setSavingRoleByUserId] = useState<string | null>(null);
  const [savingStatusByUserId, setSavingStatusByUserId] = useState<string | null>(null);
  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<string, ManagedUserRole>>({});

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<ManagedUserRole>('employee');
  const [creating, setCreating] = useState(false);

  const rowCountLabel = useMemo(() => `${rows.length} user${rows.length === 1 ? '' : 's'}`, [rows]);

  const loadUsers = async (): Promise<void> => {
    setLoading(true);
    setError('');

    try {
      const users = await usersApi.listUsers({
        search,
        role: roleFilter,
        isActive: statusFilter,
      });
      setRows(users);
      setRoleDraftByUserId(
        users.reduce<Record<string, ManagedUserRole>>((acc, row) => {
          acc[row.id] = row.role;
          return acc;
        }, {})
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to load users'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageUsers) {
      setLoading(false);
      return;
    }

    void loadUsers();
  }, [canManageUsers, roleFilter, search, statusFilter]);

  if (!canManageUsers) {
    return (
      <section className="org-users-shell">
        <article className="org-users-card">
          <h1>Organization Users</h1>
          <p className="org-users-muted">Only organization admin can access this page.</p>
        </article>
      </section>
    );
  }

  const onCreateUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      await usersApi.createUser({
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        password: formPassword,
        role: formRole,
      });
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      setFormRole('employee');
      setSuccess('User created successfully.');
      await loadUsers();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to create user'));
    } finally {
      setCreating(false);
    }
  };

  const onSaveRole = async (targetUserId: string): Promise<void> => {
    const draftRole = roleDraftByUserId[targetUserId];
    if (!draftRole) {
      return;
    }

    setSavingRoleByUserId(targetUserId);
    setError('');
    setSuccess('');
    try {
      await usersApi.updateUserRole(targetUserId, draftRole);
      setSuccess('User role updated successfully.');
      await loadUsers();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to update user role'));
    } finally {
      setSavingRoleByUserId(null);
    }
  };

  const onToggleStatus = async (row: OrganizationUserRow): Promise<void> => {
    setSavingStatusByUserId(row.id);
    setError('');
    setSuccess('');
    try {
      await usersApi.updateUserStatus(row.id, !row.isActive);
      setSuccess(`User ${row.isActive ? 'disabled' : 'enabled'} successfully.`);
      await loadUsers();
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to update user status'));
    } finally {
      setSavingStatusByUserId(null);
    }
  };

  return (
    <section className="org-users-shell">
      <header className="org-users-header">
        <div>
          <p className="org-users-kicker">Administration</p>
          <h1>Organization Users</h1>
          <p className="org-users-muted">Manage admin, HR, manager and employee accounts.</p>
        </div>
        <span className="org-users-count">{rowCountLabel}</span>
      </header>

      <article className="org-users-card">
        <h2>Create User</h2>
        <form className="org-users-form" onSubmit={(event) => void onCreateUser(event)}>
          <input
            value={formName}
            onChange={(event) => setFormName(event.target.value)}
            placeholder="Full name"
            required
          />
          <input
            type="email"
            value={formEmail}
            onChange={(event) => setFormEmail(event.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="password"
            value={formPassword}
            onChange={(event) => setFormPassword(event.target.value)}
            placeholder="Password"
            minLength={8}
            required
          />
          <select
            value={formRole}
            onChange={(event) => setFormRole(event.target.value as ManagedUserRole)}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role.toUpperCase()}
              </option>
            ))}
          </select>
          <button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </article>

      <article className="org-users-card">
        <header className="org-users-table-top">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email"
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as ManagedUserRole | '')}
          >
            <option value="">All Roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'true' | 'false' | '')}
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button type="button" onClick={() => void loadUsers()} disabled={loading}>
            Refresh
          </button>
        </header>

        {error ? <p className="org-users-error">{error}</p> : null}
        {success ? <p className="org-users-success">{success}</p> : null}
        {loading ? <p className="org-users-muted">Loading users...</p> : null}

        {!loading ? (
          <div className="org-users-table-wrap">
            <table className="org-users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Email Verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>
                      <select
                        value={roleDraftByUserId[row.id] ?? row.role}
                        onChange={(event) =>
                          setRoleDraftByUserId((prev) => ({
                            ...prev,
                            [row.id]: event.target.value as ManagedUserRole,
                          }))
                        }
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={row.isActive ? 'org-users-pill active' : 'org-users-pill inactive'}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{row.authProvider}</td>
                    <td>{row.emailVerified ? 'Yes' : 'No'}</td>
                    <td className="org-users-actions">
                      <button
                        type="button"
                        onClick={() => void onSaveRole(row.id)}
                        disabled={savingRoleByUserId === row.id}
                      >
                        {savingRoleByUserId === row.id ? 'Saving...' : 'Save Role'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleStatus(row)}
                        disabled={savingStatusByUserId === row.id}
                      >
                        {savingStatusByUserId === row.id
                          ? 'Updating...'
                          : row.isActive
                          ? 'Disable'
                          : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="org-users-empty">
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
};
