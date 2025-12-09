import { redirect } from 'next/navigation';

export default function AdminRecipesPage() {
  // Redirect to /recipes - recipes should only be accessible via /recipes
  redirect('/recipes');
}
