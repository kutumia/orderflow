export default function OrderingPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header skeleton */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
          <div className="flex-1">
            <div className="h-5 w-40 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-gray-100" />
        </div>
      </header>

      {/* Banner skeleton */}
      <div className="max-w-3xl mx-auto">
        <div className="w-full h-40 sm:h-52 bg-gray-200" />
      </div>

      {/* Info section */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="h-4 w-64 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-48 bg-gray-100 rounded mb-2" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
        </div>

        {/* Category nav skeleton */}
        <div className="flex gap-2 mb-6 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-24 bg-gray-200 rounded-full shrink-0" />
          ))}
        </div>

        {/* Menu items skeleton */}
        {[...Array(3)].map((_, ci) => (
          <div key={ci} className="mb-8">
            <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
            <div className="bg-white rounded-lg divide-y">
              {[...Array(4)].map((_, ii) => (
                <div key={ii} className="flex gap-4 p-4">
                  <div className="flex-1">
                    <div className="h-4 w-36 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-full bg-gray-100 rounded mb-1" />
                    <div className="h-3 w-16 bg-gray-200 rounded mt-2" />
                  </div>
                  <div className="h-20 w-20 bg-gray-200 rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
