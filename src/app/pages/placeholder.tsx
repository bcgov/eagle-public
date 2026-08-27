import { Outlet } from 'react-router';

/** Stands in for a page not yet ported. */
export function Placeholder({ name, withOutlet = false }: { name: string; withOutlet?: boolean }) {
  return (
    <section className="container">
      <h1>{name}</h1>
      {withOutlet && <Outlet />}
    </section>
  );
}
