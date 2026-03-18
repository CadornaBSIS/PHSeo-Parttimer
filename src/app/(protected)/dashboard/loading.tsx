function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PulseBlock className="h-10 w-64" />
        <PulseBlock className="h-5 w-80" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <PulseBlock className="mb-4 h-4 w-24" />
            <PulseBlock className="h-8 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <PulseBlock className="mb-5 h-6 w-40" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <div key={rowIndex} className="rounded-2xl border border-slate-100 p-3">
                  <PulseBlock className="mb-2 h-4 w-40" />
                  <PulseBlock className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
