import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { Spinner } from './components/Feedback';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';

/* Route-level code splitting keeps the first paint small. */
const IdeaDetails = lazy(() => import('./pages/IdeaDetails'));
const CreateIdea = lazy(() => import('./pages/CreateIdea'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const WallOfFame = lazy(() => import('./pages/WallOfFame'));
const Profile = lazy(() => import('./pages/Profile'));
const ContributorProfile = lazy(() => import('./pages/ContributorProfile'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));

/** Blocks a route until the stored session has been re-validated. */
function RequireAuth({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, initialising } = useAuth();
  const location = useLocation();

  if (initialising) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return children;
}

/** Sends an already-signed-in user away from Login/Register. */
function RedirectIfAuthed({ children }) {
  const { isAuthenticated, isAdmin, initialising } = useAuth();
  if (initialising) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/'} replace />;
  return children;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-8 w-8 text-forge-500" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

function Shell() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        <ScrollToTop />
        <Suspense fallback={<FullPageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ideas/new" element={<RequireAuth><CreateIdea /></RequireAuth>} />
            <Route path="/ideas/:id" element={<IdeaDetails />} />
            <Route path="/people/:id" element={<ContributorProfile />} />
            <Route path="/wall-of-fame" element={<WallOfFame />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth adminOnly><AdminDashboard /></RequireAuth>} />
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <Login />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthed>
                  <Register />
                </RedirectIfAuthed>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
