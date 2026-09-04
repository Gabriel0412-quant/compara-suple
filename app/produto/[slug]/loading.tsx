export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-10 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="aspect-square bg-gray-100" />
            <div className="p-6 space-y-3">
              <div className="h-3 bg-gray-100 rounded w-1/4" />
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-10 bg-gray-100 rounded w-1/2" />
              <div className="h-12 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-50 rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
