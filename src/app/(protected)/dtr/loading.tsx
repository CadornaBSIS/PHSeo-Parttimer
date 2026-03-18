function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />;
}

export default function DtrListLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <PulseBlock className="h-10 w-40" />
          <PulseBlock className="h-5 w-72" />
        </div>
        <PulseBlock className="h-10 w-32" />
      </div>

      <div className="flex items-center gap-3">
        <PulseBlock className="h-5 w-12" />
        <PulseBlock className="h-9 w-14 rounded-full" />
        <PulseBlock className="h-9 w-16 rounded-full" />
        <PulseBlock className="h-9 w-24 rounded-full" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[1.2fr_1fr_1.8fr_0.8fr_0.8fr] gap-4">
              <PulseBlock className="h-5 w-full" />
              <PulseBlock className="h-5 w-full" />
              <PulseBlock className="h-5 w-full" />
              <PulseBlock className="h-5 w-full" />
              <PulseBlock className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
