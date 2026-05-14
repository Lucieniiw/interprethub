# InterpretHub — repository layout

Monorepo managed with **pnpm workspaces**. Domain: language-services scheduling (assignments, interpreters, clients).

## Root

| Path | Purpose |
|------|---------|
| `package.json` | API + workspace scripts (`dev`, `build`, `db:*`); import map `#prisma-client` → generated client. |
| `prisma.config.ts` | Prisma CLI config (schema path, migrations folder, seed command). |
| `tsconfig.json` | TypeScript build for the Express app under `src/`. |
| `pnpm-workspace.yaml` | Includes `client`, `packages/*`. |
| `prisma/` | `schema.prisma`, `seed.ts` |
| `src/` | Express + Socket.IO application |
| `client/` | Vite + React frontend (`@interpret-hub/client`) |
| `uploads/` | User uploads (empty by default; tracked via `.gitkeep`) |
| `generated/prisma/` | Generated Prisma Client + engines (`pnpm db:generate` / build); gitignored — run generate after clone. |
| `.gitignore` | Node, build output, env files. |

**Database:** configure `.env` at the repository root, then `pnpm db:push` / `pnpm db:migrate` and `pnpm db:seed`.

## `packages/shared`

Cross-cutting **Zod** schemas consumed by API and client.

**Rule:** keep transport-agnostic contracts here (no Express/React imports).

## `src/` — Express + Prisma + Socket.IO

```
src/
  routes/              # *.routes.ts — HTTP adapters
  middleware/
    auth.middleware.ts
  services/
  lib/
    prisma.ts
    jwt.ts
    mailer.ts
    env.ts               # optional typed env (expand with zod later)
  app.ts
  index.ts               # HTTP server + Socket.IO bootstrap
```

## `client/` — React + Vite + React Router

```
client/
  index.html
  src/
    App.tsx
    main.tsx
    assets/styles/globals/global.css
    router/
      AppRouter.tsx
      ProtectedRoute.tsx
      RequireAuth.tsx
      RequireRole.tsx
      RequireInterpreter.tsx
    providers/AppProviders.tsx
    services/api/
      http-client.ts
      socket.ts
    utils/format.ts
    components/layout/
    features/
```

**Running**

- API: `pnpm dev:api` or `pnpm exec tsx watch src/index.ts`
- Client: `pnpm dev:web` (`pnpm --filter @interpret-hub/client dev`)
- Together: `pnpm dev`

**pnpm 11:** dependency install scripts must be listed under `allowBuilds` in `pnpm-workspace.yaml`. Run `pnpm approve-builds` if pnpm adds new pending packages after upgrades.
