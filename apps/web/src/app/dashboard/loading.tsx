export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-72 bg-gray-100 rounded mb-8" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-20 bg-gray-100 rounded" />
              <div className="h-8 w-8 bg-gray-100 rounded-lg" />
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="p-5 border-b">
          <div className="h-5 w-28 bg-gray-200 rounded" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b last:border-0">
            <div className="h-4 w-12 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
            <div className="h-4 w-32 bg-gray-100 rounded flex-1" />
            <div className="h-4 w-14 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
