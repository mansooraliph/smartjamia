import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PlanCards } from '@/components/public/PlanCards';

const FEATURES = [
  { icon: Users, title: 'Admissions & students', body: 'Online admission to alumni — student records, parents, bulk import and promotion.' },
  { icon: CalendarCheck, title: 'Attendance & timetable', body: 'Daily attendance, period-wise timetables, and instant parent visibility.' },
  { icon: FileBarChart, title: 'Exams & report cards', body: 'Marks entry, automatic ranking, and downloadable PDF report cards.' },
  { icon: CreditCard, title: 'Fees & billing', body: 'Fee structures, collection, receipts and online payments via Razorpay.' },
  { icon: ShieldCheck, title: 'Roles & permissions', body: 'Fine-grained access control — build custom roles for every team member.' },
  { icon: LayoutDashboard, title: 'One dashboard', body: 'Web, desktop and mobile — everything your school needs in one place.' },
];

export function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/70 to-white" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">
            <GraduationCap className="h-3.5 w-3.5" /> Multi-tenant school management
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Run your entire school from{' '}
            <span className="text-brand-600">one platform</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Admissions, attendance, exams, fees and communication — EduPro brings
            every part of academic operations together. Start free, no card required.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/signup" className="btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-base">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              See pricing
            </Link>
          </div>
          <div className="mt-6 text-sm text-slate-400">
            14-day free trial · cancel anytime · setup in minutes
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">Everything, in one place</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Replace a dozen spreadsheets and apps with a single, purpose-built system.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 font-semibold text-slate-900">{f.title}</div>
              <p className="mt-1.5 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">Simple, transparent pricing</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Every plan starts with a free trial. Upgrade when you’re ready.
            </p>
          </div>
          <div className="mt-12">
            <PlanCards />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold text-slate-900">FAQ</h2>
        <div className="mt-10 space-y-4">
          {FAQS.map((q) => (
            <div key={q.q} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="font-medium text-slate-900">{q.q}</div>
              <p className="mt-1.5 text-sm text-slate-600">{q.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-white">Ready to get started?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Set up your school in minutes and explore everything free for 14 days.
          </p>
          <Link
            to="/signup"
            className="mt-7 inline-flex items-center gap-1.5 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50"
          >
            Start your free trial <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

const FAQS = [
  { q: 'Do I need a credit card to start?', a: 'No. Every plan begins with a free trial — no card required. You only pay when you choose to subscribe.' },
  { q: 'How long is the free trial?', a: 'Most plans include a 14-day trial (Enterprise gets 30 days). Trial length is set per plan by our team.' },
  { q: 'Can I change plans later?', a: 'Yes — upgrade or change your plan anytime from the Billing section inside your school dashboard.' },
  { q: 'How are payments handled?', a: 'Subscriptions are billed securely through Razorpay. Invoices are generated automatically for every payment.' },
];
