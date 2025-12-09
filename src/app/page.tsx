import { redirect } from 'next/navigation';

export default function Home() {
  // Fallback redirect if middleware doesn't catch it
  // Middleware should handle this, but this ensures it works
  redirect('/login');
}
