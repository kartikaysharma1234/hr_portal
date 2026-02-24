import { useTenant } from '../context/TenantContext';

export const TenantNotFoundPage = (): JSX.Element => {
  const { rootDomain } = useTenant();

  return (
    <main className="page-center">
      <div className="tenant-warning">
        <h1>Tenant not found</h1>
        <p>Open this app using your company subdomain.</p>
        <p>Example: <code>acme.{rootDomain}</code></p>
      </div>
    </main>
  );
};
