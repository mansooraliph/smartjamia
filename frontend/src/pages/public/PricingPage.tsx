import { PlanCards } from '@/components/public/PlanCards';

export function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Pricing that grows with your school
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Start free for 14 days. No credit card needed. Pay only when you’re ready.
        </p>
      </div>
      <div className="mt-12">
        <PlanCards />
      </div>
      <p className="mt-10 text-center text-sm text-slate-400">
        All prices in INR and exclusive of taxes. Need something custom?{' '}
        <a href="mailto:sales@edupro.app" className="text-brand-600 hover:underline">
          Talk to sales
        </a>
        .
      </p>
    </section>
  );
}
