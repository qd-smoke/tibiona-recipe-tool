# Recipe Tool Best Practices

## Local Development Setup
- **Node.js**: v22.20.0 (`node -v`)
- **pnpm**: installed via `corepack prepare pnpm@latest --activate`; ensure `C:\Users\aldo\AppData\Local\node\corepack` is in `PATH`
- **Dependencies**: from project root run `pnpm install`, then `pnpm approve-builds` to allow Prisma/Tailwind/Sharp build steps
- **Env file**: `.env` contains `DATABASE_URL="mysql://external:3rIT+SAbRef0fr_dRe=o@142.132.135.29:3306/magento"`
- **VPN**: must be active to reach the remote DB; otherwise requests time out
- **Dev ports**: 
  - `pnpm run dev` listens on 9999 (Turbopack, hot reload)
  - `pnpm run dev-norma` uses 3000, or 3001 if 3000 is occupied
- **Corepack permissions**: if `corepack enable` fails, run PowerShell as admin or add the Corepack path manually
- **DB smoke test**: optional helper `pnpm exec node scripts\db-check.js` (manual script, not tracked) to confirm table counts
- **DB debugging tool**: `pnpm read-db <tableName> [options]` or `pnpm read-db --sql "SQL_QUERY"` to read/modify database tables. Supports filters, limits, column selection, and direct SQL execution. Useful for debugging and quick database inspections. See `scripts/read-db-table.ts` for full usage.
- **Starting the server**: 
  ```powershell
  # Fast mode (Turbopack, recommended)
  pnpm run dev          # port 9999
  
  # Classic mode (fallback)
  pnpm run dev-norma    # port 3000 or 3001
  ```
- **Production build**: `pnpm run build` (run before pushing to catch errors)

## Tech Stack & General Workflow
- **TypeScript-first**: write new code with types, staying consistent with `src/app` and `src/db`.
- **Branch naming**: use `name-YYYY-MM-DD` (e.g. `aldo-2025-11-13`) for feature/fix branches; keep commits small and descriptive.
- **Environment handling**: never commit `.env`; set `DATABASE_URL` for the remote DB.
- **Auth secret**: define `AUTH_SECRET` (or reuse `NEXTAUTH_SECRET`) for signing session cookies used by the permissions portal.
- **pnpm only**: keep `pnpm-lock.yaml` in sync and avoid `npm install` to prevent drift.
- **Pre-flight checks**: run `pnpm run build` before pushing/creating PRs to catch Next/ESLint issues early. Always run `npx eslint src --ext .ts,.tsx` before committing to catch linting errors.
- **English comments**: write in-code comments and documentation in English for team consistency.
- **Recipe imports**: JSON imports must provide `Codice Ingrediente N` (SKU). The importer uses that SKU to pull Magento nutrition data automatically—verify the codes before running an import.
- **Product search by SKU**: The `/api/products/by-skus` endpoint searches products in `catalog_product_entity` (base table) using case-insensitive SKU matching. DO NOT use `catalog_product_flat_1` as it may not contain all products. Products are built from base tables to ensure all products are found, including those not indexed in the flat table.
- **ESLint & Code Quality**: Never bypass git hooks (husky) that run ESLint. If you see ESLint errors, fix them before committing. Use `npx eslint src --ext .ts,.tsx --fix` to auto-fix formatting issues, then manually fix remaining warnings. Unused variables should be prefixed with `_` (e.g., `_unusedVar`) to indicate intentional non-use.
- **Type Safety**: Avoid using `any` or `unknown` types without proper type guards. Always define proper types in `src/types/index.ts` for database records and their transformed versions (e.g., `AppRoleRecord` → `AppRole`, `PermissionProfileRecord` → `PermissionProfile`). When creating new types, ensure both the database record type (`*Record`) and the transformed/input types (`*Input`, transformed version) are defined.
- **React Hooks**: Always include all dependencies in `useEffect`, `useCallback`, and `useMemo` dependency arrays. If a dependency is intentionally excluded, wrap it in `useCallback` or `useMemo` in the parent component, or disable the rule with an explanatory comment.

## Frontend (Next.js)
- Use client components only when hooks/state are required; prefer server components otherwise.
- Reuse shared components (`src/components`, e.g. `Checkbox`) instead of duplicating markup or logic.
- Keep data fetching in server-side routes (`app/api/...`) so that typing and validation stay centralized.
- Validate runtime params (e.g. `params`) using helpers like `parseId`, and handle `notFound` paths explicitly.

## Database & API
- Access MySQL exclusively through the `drizzle` layer (`src/db`); avoid scattering raw SQL.
- Return consistent error responses (`badRequest`, `notFound`, `NextResponse.json`) for predictable clients.
- Database server lives at `142.132.135.29`; double-check queries before running destructive operations.
- **Database schema migrations**: When adding new columns to the schema (`src/db/schema.ts`), ensure the corresponding migration script is executed on the database. Use scripts in `scripts/` directory (e.g., `scripts/add-quality-process-fields.ts`) with `--execute` flag. Always verify schema matches database structure before deploying to avoid SQL errors.
- **Recipe import troubleshooting**: If recipes are imported but not visible, check that all schema columns exist in the database. Missing columns (e.g., `laboratory_humidity_percent`, `external_temperature_c`) will cause silent query failures. Use `pnpm read-db dddev_recipe --limit 1` to verify table structure.
- **Recipe metadata (SKU, Category, Clients)**: Recipes now support SKU (internal code), category (single selection), and clients (multi-selection). These fields are editable inline in the recipes table. Categories and clients are managed via `/admin/recipes/metadata` page. The SKU field is optional and can be used for internal recipe identification.
- **ExcelRx JSON format**: Export/import JSON includes `SKU`, `Categoria` (category name), and `Clienti` (comma-separated client names). When importing, category and client names are automatically resolved to their IDs. Use scripts in `scripts/` directory to seed initial categories and clients (e.g., `scripts/seed-categories-clients.ts`).

-## UI/UX
- Avoid React warnings: controlled inputs need `onChange`; otherwise use `default*` props.
- Provide user feedback (loading states, toasts, empty states) similar to `RecipesTable`.
- Use Tailwind utility classes and follow existing spacing/color tokens.
- In the recipe editor, keep `Impasto cotto` read-only and derive it as `(packageWeight * numberOfPackages) / 1000` so production weight stays consistent across views.
- **Layout**: Header is full-width (100%) with navigation menu between logo and login widget. Main content container uses 75% width (`w-[75%]`) for better readability on large screens.
- **Inline editing**: Recipe name, SKU, category, and clients support inline editing. Name field shows edit icon on hover; clicking the icon activates edit mode without navigating to recipe page. Use `InlineEditableCell` component for consistent inline editing behavior.
- **Checkbox styling**: Custom checkbox controls (e.g., “Fatto”, “Check glutine”) should apply a dedicated class/token that enforces `height`/`width` via CSS instead of relying on global utilities like `.w-4`, so they stay square even if the utility is overridden elsewhere.
- **Portal header**: Only render the “Portal · Ricette” header when `portal.recipes` is visible. If no navigation links are available, the navigation bar should disappear entirely to avoid empty “brodo” UI.
- **Toast Notifications**: Use the global toast reducer for user feedback:
  - Provider: `ToastProvider` wraps the app in `src/app/layout.tsx`
  - Hook: `useSetToast()` returns `setToast(message, { type?: 'info'|'success'|'warning'|'error', duration?: number })`
  - Example:
    ```typescript
    'use client'
    import { useSetToast } from '@/state/ToastProvider';
    
    export default function Example() {
      const setToast = useSetToast();
      return <button onClick={() => setToast('Saved!', { type: 'success' })}>Notify</button>;
    }
    ```

## Permissions & Access Control
- **Always use canonical IDs**: Widget visibility/editability must leverage the canonical IDs defined in `PERMISSION_TREE`; never hard-code ad-hoc capability keys.
- **Gate rendering**: Use `canView()` to gate rendering and `canEdit()` to block interactivity from `src/lib/permissions/check` so read-only users can see allowed data without mutating it.
- **Protected pages**: Verify capabilities before fetching or mutating data; short-circuit early and surface clear messages if user lacks access.
- **Ingredients table columns**: Each column can be individually hidden/shown via permissions. Use `canViewIngredientColumn(columnId)` helper which checks `recipe.ingredients.column.<columnId>` capability. Capability IDs follow pattern `recipe.ingredients.column.<columnId>`.
- **Operator view**: When `isOperatorViewActive` is `true`, `canView()` uses "deny-by-default" (returns `false` if capability not explicitly defined). For non-operator views, default is `true` for backward compatibility.
- **Hidden capabilities (visible: false)**: When a capability is set to `visible: false` in role permissions, it must be explicitly denied. The `canViewField()` function checks for explicit `visible: false` on the specific capability and parent rules before falling back to `canView()` opt-in logic. This ensures that hidden capabilities are properly denied even if parent rules would allow them.

## User Roles & Permissions
- **Roles**: Two roles available: `admin` and `operator` (defined in `src/constants/roles.ts`). Admin role automatically grants all capabilities as `visible: true, editable: true`.
- **Permission Tree**: Supports parent nodes (e.g., `recipe.costs`) and child nodes (e.g., `recipe.costs.hourly_labor`). When modifying a parent node, both the parent and all children IDs must be included in the save payload. Always verify parent nodes are present when saving roles.
- **Operator View**: Admins can toggle "Vista Operatore" to simulate operator view for testing permissions. Use `getEffectiveCapabilities()` which returns operator capabilities when `isOperatorView` is true.
- **Extensibility**: New roles can be added to `ROLE_OPTIONS` in `src/constants/roles.ts`.
- **Debugging**: Use debug logs in `RolesTab.tsx` and `api/roles/route.ts` to verify capabilities are correctly serialized. Check that parent nodes are included in save payloads.
- **Admin password reset**: Admins can reset other users’ passwords via the new `/api/permissions/users/<userId>/password` endpoint. The capability `admin.permissions` gates the UI and API (see `src/app/admin/permissions/UsersTab.tsx`).

## Process Fields & Costs
- **Process fields**: Include all process fields (`cookieWeightCookedG`, `mixerCapacityKg`, `traysCapacityKg`, `depositorCapacityKg`, `traysPerOvenLoad`, `steamMinutes`, `valveOpenMinutes`, `valveCloseMinutes`, `glutenTestDone`, `lot`) in recipe payloads when saving. Note: Fields that are calculated automatically (like `cookiesCount`, `cookieWeightRawG`, `trayWeightRawG`, `trayWeightCookedG`, `doughBatchesCount`, `depositorsCount`, `traysCount`, `traysPerBatch`, `traysPerDepositors`, `ovenLoadsCount`) should NOT be displayed as input fields if they're already shown in the calculated data panel.
- **Colatrice settings**: Recipe-specific machine settings stored as JSON in `colatrice_settings` column. Managed via "Setting Colatrice" widget with four tabs (Home, Setting page 1, Setting page 2, Setting page 3). Permissions controlled via `recipe.colatrice.*` capabilities.
- **Oven temperatures and mixing times**: Stored as arrays in separate tables. When saving, ensure `order` is set correctly (0-based index).
- **Costs**: Recipe costs are saved automatically when saving a recipe (no separate save button needed). Cost fields respect permissions via `recipe.costs` capability—the parent node `recipe.costs` must be explicitly configured in role capabilities (not just child nodes).
- **Standard costs**: Managed via `/admin/costs/standard` page (requires `admin.costs.standard` permission). When displaying costs, merge standard costs with recipe-specific costs (recipe costs override standard values).
- **Standard parameters and defaults**: Managed via `/admin/parameters/standard` page. Includes standard parameters (capacities, weights, percentages), colatrice defaults (machine settings), and process defaults (default process configurations). Colatrice defaults and process defaults are stored in `dddev_colatrice_defaults` table—process defaults use `id=0` or contain `{ processes: [...] }` structure, while colatrice defaults use different IDs and contain `{ schermata_1: {...}, schermata_2: {...}, ... }` structure. The API endpoints `/api/parameters/colatrice-defaults` and `/api/parameters/process-defaults` distinguish between these types when fetching/updating.

## Production Tracking & Recipe Versioning
- **When saving during production**: Include `isProduction: true` and `productionId` in the PUT request body. The API will automatically create a new version if changes are detected.
- **Ingredient overrides**: During production, ingredient-specific overrides (lot, product name, SKU, supplier, warehouse location) can be saved via `ingredientOverrides` array in the PUT request. These don't modify the base recipe.
- **Versioning**: During production, any recipe modification automatically creates a new version. Admin changes outside production only create history entries (no new version).

## Git Workflow & Branch Management
- **Branch naming**: use `name-YYYY-MM-DD` (e.g. `aldo-2025-11-13`) for feature/fix branches.
- **Before merging**: always check `git status` to ensure working tree is clean.
- **Quick merge process**:
  1. Ensure you're on `master`: `git checkout master`
  2. Pull latest changes: `git pull origin master`
  3. Merge feature branch: `git merge --no-ff <branch-name>`
  4. Push to trigger pipeline: `git push origin master`
- **Detailed workflow**: See [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) for complete instructions including:
  - Using PowerShell scripts (`merge-branch.ps1`, `complete-merge.ps1`)
  - Handling interrupted merges
  - Resolving conflicts
  - Troubleshooting common issues
- **Never force-push to master**: always use merge commits to preserve history.

## Deploy & Pipeline
- Pushing to `master` triggers the Bitbucket pipeline (see `bitbucket-pipelines.yml`).
- **Build step**: Creates standalone bundle with `pnpm build`, generates artifacts (`.next/standalone`, `.next/static`, `public`, dependencies).
- **Deploy step**: 
  - Uploads files via tar+scp (more reliable than rsync with protocol issues)
  - Installs runtime dependencies with `npm install --omit=dev`
  - Restarts PM2 process on SiteGround
  - Clears cache via `_purge.php` (same approach as `serverpush` in aliases.ps1)
- **Deploy path on SiteGround**: `/home/u233-wq8l7cu1t9ot/www/tool.tibiona.it/public_html/recipe-tool`
  - Structure: `$DEPLOY_PATH/standalone/` contains the Next.js app, `standalone/server.js` is the entry point
  - PM2 runs the app from this path on port 3000 using `ecosystem.config.js` which loads environment variables from `standalone/.env`
  - **Static files**: A symlink `_next -> standalone/.next` is created during deploy to allow the web server (Apache/Nginx) to serve static files directly. This is necessary because Next.js standalone mode doesn't serve static files correctly in this setup, and the web server intercepts `_next/static` requests before they reach Next.js.
- **Required Bitbucket variables** (managed by ops): `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PUBLIC_KEY`, `DEPLOY_PATH`, `APP_URL`, `DATABASE_URL`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `AUTH_SECRET`.
- **Environment variables update**: Bitbucket environment variables have been updated to ensure proper deployment functionality. When pushing to `master`, the pipeline automatically starts and regenerates the `.env` file on the server with the correct values.
- **Do not change** the deploy commands without syncing with the main dev; use `sendfile` only for emergency fixes if pipeline is unavailable.
- Skip unnecessary postinstall scripts. Run `pnpm approve-builds` locally when dependencies request build scripts.

