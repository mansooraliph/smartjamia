import { Suspense } from 'react';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-slate-500">
          Loading…
        </div>
      }
    >
      <AppRoutes />
    </Suspense>
  );
}
