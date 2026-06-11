import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Search,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/cn';

const navItems = [
  { to: '/superadmin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/superadmin/schools', label: 'Schools', icon: Building2 },
  { to: '/superadmin/branches', label: 'Branches', icon: GitBranch },
  { to: '/superadmin/plans', label: 'Plans', icon: CreditCard },
  { to: '/superadmin/subscriptions', label: 'Subscriptions', icon: ReceiptText },
];

const secondaryNav = [
  { to: '/superadmin/admins', label: 'Admins', icon: ShieldCheck },
  { to: '/superadmin/settings', label: 'Settings', icon: Settings },
];

export function SuperadminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/superadmin/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-slate-200 bg-slate-900 text-slate-100 transition-all duration-200',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-slate-800 px-4',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">EduPro</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Platform Console
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {!collapsed && (
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Manage
            </div>
          )}
          <ul className="space-y-0.5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      collapsed && 'justify-center px-2',
                    )
                  }
                  title={collapsed ? label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>

          {!collapsed && (
            <div className="mb-2 mt-6 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Platform
            </div>
          )}
          <ul className="space-y-0.5">
            {secondaryNav.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      collapsed && 'justify-center px-2',
                    )
                  }
                  title={collapsed ? label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-slate-800 p-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white',
              collapsed && 'justify-center px-2',
            )}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search schools, plans…"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-1 focus:ring-brand-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <div className="text-sm font-medium text-slate-800">
                  {user?.name ?? 'Admin'}
                </div>
                <div className="text-xs capitalize text-slate-500">
                  {user?.role}
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
                {(user?.name ?? 'A').charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
