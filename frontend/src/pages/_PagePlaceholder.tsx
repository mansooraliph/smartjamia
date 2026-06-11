interface Props {
  title: string;
  description?: string;
}

export function PagePlaceholder({ title, description }: Props) {
  return (
    <div className="card p-8">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="text-slate-600">
        {description ?? 'Coming soon. This module is part of Day 2+ work.'}
      </p>
    </div>
  );
}
