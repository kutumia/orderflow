import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-brand-600 mb-4">404</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-primary text-sm">
            Go Home
          </Link>
          <Link href="/login" className="btn-secondary text-sm">
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
