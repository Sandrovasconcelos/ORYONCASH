function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-brand-sm bg-brand-gray-300/55 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Carregando conteúdo...</span>

      <div className="flex items-center gap-2 border-b border-brand-gray-300 pb-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>

      <div className="rounded-card border border-brand-gray-300/70 bg-white p-5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <Skeleton className="h-10 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-card border border-brand-gray-300/70 bg-white p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-3/4" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="rounded-card border border-brand-gray-300/70 bg-white p-5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-6 h-52 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
