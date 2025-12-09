# Recipe Tool - tool.tibiona.it

This is a [Next.js](https://nextjs.org) project for managing recipes and nutritional data, integrated with Magento.

## Quick Start

See the [Local Development Setup](./best_practice_recipe_tool.md#local-development-setup) section in Best Practices for complete setup instructions.

## Documentation

- **[Best Practices](./best_practice_recipe_tool.md)** - Complete development guidelines, coding standards, local setup, and workflow
- **[Git Workflow](./GIT_WORKFLOW.md)** - Detailed guide for managing branches, merges, and troubleshooting (includes PowerShell scripts)

## Development

```bash
# Install dependencies
pnpm install

# Run development server (port 9999)
pnpm run dev

# Build for production
pnpm run build
```

## Git Workflow

Use the provided PowerShell scripts for safe branch management:

```powershell
# Merge a feature branch into master
.\merge-branch.ps1 -BranchName "aldo-2025-11-13"

# Complete an interrupted merge
.\complete-merge.ps1

# Check repository status
.\check-repo-status.ps1
```

See [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) for detailed instructions.

## Deployment

- Push to `master` triggers the Bitbucket pipeline defined in `bitbucket-pipelines.yml`
- Step 1 builds the standalone Next.js bundle via `pnpm build`
- Step 2 deploys to SiteGround via SSH/rsync and restarts PM2
- **Deploy path**: `/home/u233-wq8l7cu1t9ot/www/tool.tibiona.it/public_html/recipe-tool`
- Required repository variables (managed by the lead dev):
  - `SSH_HOST`, `SSH_PORT`
  - `SSH_USER`
  - `SSH_PRIVATE_KEY`, `SSH_PUBLIC_KEY`
  - `DEPLOY_PATH` (set to the path above)
- Avoid modifying the deploy step unless coordinated with the dev/ops owner
