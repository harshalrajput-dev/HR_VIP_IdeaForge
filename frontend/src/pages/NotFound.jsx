import { Link } from 'react-router-dom';

/** 404 page for unknown routes. */
export default function NotFound() {
  return (
    <div className="container-app flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-7xl font-black text-slate-200">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">This idea does not exist</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page you were looking for was moved, deleted, or never made it out of the forge.
      </p>
      <div className="mt-8 flex gap-3">
        <Link to="/" className="btn-primary">
          Back to the feed
        </Link>
        <Link to="/wall-of-fame" className="btn-ghost">
          Wall of Fame
        </Link>
      </div>
    </div>
  );
}
