import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  CalendarCheck,
  Wallet,
  FileBarChart,
  Briefcase,
  Library,
  Bus,
  Layers,
  BookOpen,
  CalendarRange,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { SchoolStatsApi } from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useTerminology } from '@/hooks/useTerminology';
import { isAdminRole } from '@/lib/access';

export function DashboardPage() {
  const { user, schoolSlug } = useAuthStore();
  const term = useTerminology();
  const isAdmin = isAdminRole(user?.role);
  const { data: stats, isLoading } = useQuery({
    queryKey: ['school-stats'],
    queryFn: SchoolStatsApi.overview,
  });

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const currentYearName = stats?.academicYears.current?.name;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name ?? 'there'}`}
        description={`${schoolSlug ? schoolSlug.toUpperCase() : ''} · ${today}`}
        actions={
          currentYearName ? (
            <Badge tone="green">{currentYearName}</Badge>
          ) : (
            <Badge tone="amber">No current academic year</Badge>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          to="/students"
          icon={GraduationCap}
          label="Students"
          value={stats?.students.total ?? 0}
          loading={isLoading}
          tone="blue"
          subline={stats ? `${stats.students.active} active` : undefined}
        />
        <StatCard
          to="/staff"
          icon={Briefcase}
          label="Staff"
          value={stats?.staff.total ?? 0}
          loading={isLoading}
          tone="indigo"
          subline={stats ? `${stats.staff.active} active` : undefined}
        />
        <StatCard
          to="/setup/classes"
          icon={Layers}
          label={term.levelPlural}
          value={stats?.classes.total ?? 0}
          loading={isLoading}
          tone="purple"
        />
        <StatCard
          to="/setup/classes"
          icon={Users}
          label={term.groupPlural}
          value={stats?.sections.total ?? 0}
          loading={isLoading}
          tone="purple"
        />
        <StatCard
          to="/setup/subjects"
          icon={BookOpen}
          label="Subjects"
          value={stats?.subjects.total ?? 0}
          loading={isLoading}
          tone="amber"
        />
        <StatCard
          to="/setup/academic-years"
          icon={CalendarRange}
          label="Years"
          value={stats?.academicYears.total ?? 0}
          loading={isLoading}
          tone="green"
        />
      </div>

      {/* Admin-only setup + quick links */}
      {isAdmin && (
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-1 font-semibold text-slate-900">Getting started</h3>
          <p className="mb-4 text-sm text-slate-500">
            Complete these steps to get your school operational.
          </p>
          <ol className="space-y-3">
            <OnboardingStep
              num={1}
              title="Set up the current academic year"
              desc={`E.g. 2026-27 — required before adding ${term.levelPlural.toLowerCase()}.`}
              done={(stats?.academicYears.total ?? 0) > 0}
              link="/setup/academic-years"
            />
            <OnboardingStep
              num={2}
              title={`Add ${term.levelPlural.toLowerCase()} and ${term.groupPlural.toLowerCase()}`}
              desc={`${term.level} 1A, 1B… up to your highest level.`}
              done={(stats?.classes.total ?? 0) > 0}
              link="/setup/classes"
            />
            <OnboardingStep
              num={3}
              title={`Define subjects per ${term.level.toLowerCase()}`}
              desc="With max marks and pass marks."
              done={(stats?.subjects.total ?? 0) > 0}
              link="/setup/subjects"
            />
            <OnboardingStep
              num={4}
              title="Add staff (teachers)"
              desc="Each staff gets a login account."
              done={(stats?.staff.total ?? 0) > 0}
              link="/staff"
            />
            <OnboardingStep
              num={5}
              title="Enroll your first students"
              desc="Admission number, parent details, photo."
              done={(stats?.students.total ?? 0) > 0}
              link="/students"
            />
          </ol>
        </div>

        <div className="card p-6">
          <h3 className="mb-4 font-semibold text-slate-900">Quick links</h3>
          <ul className="space-y-1">
            <QuickLink to="/students" icon={GraduationCap} label="Students" />
            <QuickLink to="/staff" icon={Briefcase} label="Staff" />
            <QuickLink
              to="/setup/classes"
              icon={Layers}
              label={`${term.levelPlural} & ${term.groupPlural}`}
            />
            <QuickLink to="/setup/subjects" icon={BookOpen} label="Subjects" />
            <QuickLink
              to="/setup/academic-years"
              icon={CalendarRange}
              label="Academic Years"
            />
          </ul>
        </div>
      </div>
      )}

      {/* Modules grid (admin) */}
      {isAdmin && (
      <div className="mt-6">
        <h3 className="mb-3 font-semibold text-slate-900">Modules</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ModuleTile icon={CalendarCheck} label="Attendance" to="/attendance" />
          <ModuleTile icon={FileBarChart} label="Exams" to="/exams" />
          <ModuleTile icon={Wallet} label="Fees" to="/fees" />
          <ModuleTile icon={Library} label="Library" to="/library" />
          <ModuleTile icon={Bus} label="Transport" to="/transport" />
          <ModuleTile icon={Building2} label="Hostel" to="/hostel" />
          <ModuleTile icon={CalendarRange} label="Timetable" to="/timetable" />
          <ModuleTile icon={FileBarChart} label="Reports" to="/reports" />
        </div>
      </div>
      )}
    </>
  );
}

function StatCard({
  to,
  icon: Icon,
  label,
  value,
  subline,
  tone,
  loading,
}: {
  to: string;
  icon: typeof Users;
  label: string;
  value: number;
  subline?: string;
  tone: 'blue' | 'indigo' | 'purple' | 'amber' | 'green';
  loading?: boolean;
}) {
  const toneClass = {
    blue: 'bg-blue-100 text-blue-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
  }[tone];

  return (
    <Link
      to={to}
      className="card group block p-4 transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {loading ? <span className="text-slate-300">—</span> : value}
          </div>
          {subline && (
            <div className="mt-0.5 text-[10px] text-slate-500">{subline}</div>
          )}
        </div>
        <div className={`rounded-md p-1.5 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function OnboardingStep({
  num,
  title,
  desc,
  done,
  link,
}: {
  num: number;
  title: string;
  desc: string;
  done: boolean;
  link: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {done ? '✓' : num}
      </div>
      <div className="flex-1">
        <Link
          to={link}
          className="text-sm font-medium text-slate-900 hover:text-brand-600"
        >
          {title}
        </Link>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <Badge tone={done ? 'green' : 'slate'}>
        {done ? 'Done' : 'Pending'}
      </Badge>
    </li>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Users;
  label: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </Link>
    </li>
  );
}

function ModuleTile({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof Users;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="card flex flex-col items-center justify-center gap-2 p-4 text-center transition hover:border-brand-300 hover:bg-brand-50"
    >
      <Icon className="h-6 w-6 text-brand-600" />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </Link>
  );
}
