import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function PublicLayout() {
  const navigate = useNavigate();
  const isAuthed = useAuthStore((s) => s.isAuthenticated());

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">EduPro</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="/#features" className="hover:text-slate-900">Features</a>
            <NavLink
              to="/pricing"
              className={({ isActive }) =>
                isActive ? 'text-brand-600' : 'hover:text-slate-900'
              }
            >
              Pricing
            </NavLink>
            <a href="/#faq" className="hover:text-slate-900">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            {isAuthed ? (
              <button onClick={() => navigate('/dashboard')} className="btn-primary">
                Go to dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Log in
                </button>
                <button onClick={() => navigate('/signup')} className="btn-primary">
                  Start free trial
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-brand-600" />
            <span>© {YEAR} EduPro — Academic Management SaaS</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/pricing" className="hover:text-slate-700">Pricing</Link>
            <Link to="/signup" className="hover:text-slate-700">Get started</Link>
            <Link to="/login" className="hover:text-slate-700">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Static year — Date.now() isn't needed for a copyright line.
const YEAR = 2026;
