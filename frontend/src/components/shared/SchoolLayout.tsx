import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  CalendarCheck,
  FileBarChart,
  Wallet,
  Briefcase,
  Library,
  Bus,
  Building2,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Search,
  Bell,
  CalendarRange,
  BookOpen,
  Layers,
  FileText,
  UserCheck,
  DoorOpen,
  Fingerprint,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useTerminology } from '@/hooks/useTerminology';
import { usePermissions } from '@/hooks/usePermissions';
import { canAccessPath } from '@/lib/access';
import { TrialBanner } from './TrialBanner';
import { ImpersonationBanner } from './ImpersonationBanner';
import { SchoolSwitcher } from './SchoolSwitcher';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  end?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Academic Setup',
    items: [
      { to: '/setup/academic-years', label: 'Academic Years', icon: CalendarRange },
      { to: '/setup/classes', label: 'Classes & Sections', icon: Layers },
      { to: '/setup/subjects', label: 'Subjects', icon: BookOpen },
      { to: '/promotion', label: 'Promotion', icon: GraduationCap },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/students', label: 'Students', icon: GraduationCap },
      {
        to: '/transfer-certificates',
        label: 'Transfer Certificates',
        icon: FileText,
      },
      { to: '/staff', label: 'Staff', icon: Briefcase },
      { to: '/parents', label: 'Parents', icon: Users },
    ],
  },
  {
    label: 'Front Office',
    items: [
      { to: '/visitors', label: 'Visitors', icon: UserCheck },
      { to: '/visits', label: 'Visits', icon: DoorOpen },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/exams', label: 'Exams', icon: FileBarChart },
      { to: '/fees', label: 'Fees', icon: Wallet },
      { to: '/timetable', label: 'Timetable', icon: CalendarRange },
      { to: '/biometric-devices', label: 'Biometric Devices', icon: Fingerprint },
    ],
  },
  {
    label: 'Modules',
    items: [
      { to: '/library', label: 'Library', icon: Library },
      { to: '/transport', label: 'Transport', icon: Bus },
      { to: '/hostel', label: 'Hostel', icon: Building2 },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/reports', label: 'Reports', icon: FileBarChart },
      { to: '/billing', label: 'Billing', icon: Wallet },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function SchoolLayout() {
  const navigate = useNavigate();
  const { user, logout, schoolSlug } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const term = useTerminology();
  const { ctx } = usePermissions();

  // School-configurable labels for level/group-related nav items.
  const labelFor = (to: string, fallback: string) => {
    if (to === '/setup/classes')
      return `${term.levelPlural} & ${term.groupPlural}`;
    return fallback;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={cn(
          'flex flex-col border-r border-slate-200 bg-white transition-all duration-200',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-slate-200 px-4',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="text-sm font-semibold text-slate-900">EduPro</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  {schoolSlug ? schoolSlug.toUpperCase() : 'School'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav groups — filtered by the user's role */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups
            .map((g) => ({
              ...g,
              items: g.items.filter((it) => canAccessPath(ctx, it.to)),
            }))
            .filter((g) => g.items.length > 0)
            .map((g) => (
            <div key={g.label} className="mb-4">
              {!collapsed && (
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {g.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {g.items.map(({ to, label, icon: Icon, end }) => {
                  const display = labelFor(to, label);
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                            isActive
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                            collapsed && 'justify-center px-2',
                          )
                        }
                        title={collapsed ? display : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{display}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse */}
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100',
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
          <div className="flex items-center gap-3">
            <SchoolSwitcher />
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search students, staff…"
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-1 focus:ring-brand-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <div className="text-sm font-medium text-slate-800">
                  {user?.name ?? 'User'}
                </div>
                <div className="text-xs capitalize text-slate-500">
                  {user?.role}
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
                {(user?.name ?? 'U').charAt(0).toUpperCase()}
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

        <ImpersonationBanner />
        <TrialBanner />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
