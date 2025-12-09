import { redirect } from 'next/navigation';

export default function Admin() {
  // Redirect to Recipes section by default
  redirect('/recipes');
}
