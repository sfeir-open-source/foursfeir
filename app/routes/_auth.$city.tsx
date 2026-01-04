import { Link, Outlet, UIMatch } from "@remix-run/react";


export default function City() {
  return (
    <main className="container">
      <Outlet />
    </main>
  );
}

export const handle = {
  breadcrumb: (match: UIMatch<{}>) => (
    <Link to={match.pathname}>{match.params.city}</Link>
  ),
};
