export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="rounded border border-zinc-800 px-6 py-10 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-zinc-400">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
    </div>
  );
}
