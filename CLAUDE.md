# OpenGym — AI Engineering Context

This file provides persistent context, architecture decisions, development rules, and learning requirements for AI coding agents working on OpenGym.

Read this file before making any changes to the repository.

---

# 1. Project Overview

OpenGym is a web application for discovering basketball runs and drop-in basketball programs.

The initial data source being integrated is the City of Toronto's official Open Data / recreation-program data.

The long-term goal is to build a reliable ingestion pipeline that:

1. retrieves official Toronto recreation/drop-in data;
2. identifies basketball programs;
3. normalizes the source data;
4. maps Toronto locations to OpenGym venues;
5. creates normalized run candidates;
6. allows an admin to review proposed changes;
7. eventually creates/updates OpenGym `Run` records;
8. keeps imported data synchronized over time;
9. preserves source provenance and historical state;
10. eventually supports additional municipalities and data providers.

The Toronto importer is intentionally being built as a robust ingestion system rather than as a one-off scraper.

---

# 2. Important Development Philosophy

The primary purpose of this project is not just to produce working software.

The developer is actively learning software engineering while building OpenGym.

Therefore, AI agents must optimize for:

- correctness;
- maintainability;
- understanding;
- explicit architectural reasoning;
- incremental implementation;
- strong testing;
- learning through implementation.

Do not simply write large amounts of code without explanation.

When implementing a non-trivial feature:

1. explain what the component does;
2. explain why it exists;
3. explain the important design decisions;
4. identify alternatives where relevant;
5. explain how the implementation fits the existing architecture;
6. provide knowledge checks when the work is part of a learning step.

Avoid unnecessary abstraction.

Prefer simple, explicit designs over clever architectures.

---

# 3. AI Agent Permission Rules

## Reading

AI agents MAY freely:

- read repository files;
- inspect source code;
- inspect configuration;
- inspect Prisma schema;
- inspect tests;
- inspect local documentation;
- inspect `node_modules/next/dist/docs/`;
- search the repository.

Do not ask permission before reading files.

## Modifying files

AI agents MUST NOT modify files unless the developer explicitly authorizes the modification.

Before making changes, explain:

1. what will be changed;
2. why;
3. which files will change;
4. the architectural impact;
5. any risks.

Then wait for explicit approval.

## Commands

AI agents MUST NOT run commands unless explicitly authorized.

This includes:

- `npm run ...`;
- `npx ...`;
- database commands;
- Prisma commands;
- migrations;
- tests;
- linting;
- type checking;
- builds;
- development servers;
- Git commands;
- package installation;
- package removal.

Before running a command, explain:

1. the exact command;
2. what it verifies or accomplishes;
3. whether it modifies files;
4. whether it accesses a database;
5. whether it makes network requests;
6. expected scope/duration.

Then wait for explicit approval.

## Network

Do not make network requests unless explicitly authorized.

This includes:

- live Toronto CKAN requests;
- scraping Toronto pages;
- API calls;
- external HTTP requests;
- browser automation against external sites.

Local fixture-based testing is preferred.

## Database

Never assume which database is safe to use.

Before running database-backed tests or commands:

1. identify the configured database;
2. determine whether it is development, test, staging, or production;
3. explain the risk;
4. ask for permission.

Never modify production data.

## Git

Do not:

- commit;
- push;
- reset;
- rebase;
- force-push;
- checkout branches;

without explicit authorization.

---

# 4. Current Technology Stack

The project currently uses:

- Next.js 16.2.4
- React 19.2.4
- TypeScript
- Prisma 7.8.0
- PostgreSQL (using Neon)
- Prisma Client generated into `src/generated/prisma`
- `@prisma/adapter-pg`
- `pg`
- Clerk
- `@clerk/nextjs`
- Zod 4
- Tailwind CSS 4
- Vitest
- Playwright
- ESLint

Do not assume these versions are current.

When a version-specific behavior matters, inspect the installed package or local documentation.

For Next.js behavior, prefer the locally installed documentation under:

```text
node_modules/next/dist/docs/
```

---

# 5. Databases and Migrations

## Where each database lives

| Environment | Database | Configured by |
| --- | --- | --- |
| Local development | `opengym_dev` on local PostgreSQL 18 (Postgres.app; binaries in `/Applications/Postgres.app/Contents/Versions/18/bin/`) | `DATABASE_URL` in `.env` |
| Local integration tests | `opengym_test` on the same local server | `DATABASE_URL` in `.env.test`, loaded by `vitest.integration.config.ts` |
| CI | a throwaway `opengym_test` in a `postgres:18` service container | `DATABASE_URL` in `.github/workflows/ci.yml` |
| **Production** | **Neon serverless PostgreSQL, AWS `us-east-1` (N. Virginia)**, reached from Vercel functions in `iad1` | `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, set as Vercel project environment variables |

The production connection string is a Vercel secret. It is deliberately not in
any local file and cannot be read back from the Vercel dashboard. Do not ask
for it, do not copy it into `.env`, and do not write it into any file.

## Production migrations run themselves — never run one by hand

`package.json` defines:

```json
"vercel-build": "if [ \"$VERCEL_ENV\" = \"production\" ]; then npx prisma migrate deploy; fi && next build"
```

Vercel runs `vercel-build` in preference to `build`, so **merging to `main`
deploys and applies pending migrations in the same step**. Nothing else is
required to migrate production.

Never run `npx prisma migrate deploy` against production from a developer
machine. The URL is not available locally by design, the deploy owns that step
and an out-of-band run can race it, and this project has no automated
production backup to fall back on.

## Why `DATABASE_URL_UNPOOLED` exists

`prisma.config.ts` resolves the migration URL as:

```ts
url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
```

Prisma's migration engine takes a PostgreSQL advisory lock so two deploys
cannot migrate at once. A PgBouncer-style pooler in transaction mode does not
keep session state between statements, so that lock can be silently lost.
Migrations therefore need the direct (unpooled) connection, while the app's
runtime queries are free to use the pooled one.

Note that `prisma.config.ts` is read by the Prisma CLI only. It is not loaded
at runtime, so it has no effect on the running application.

## Adding a migration

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <snake_case_name>` — applies to `opengym_dev`
   and writes `prisma/migrations/<timestamp>_<name>/migration.sql`.
3. `npx prisma generate` — run it explicitly. `migrate dev` does not reliably
   regenerate the client, and `npm run typecheck` then fails on the new fields.
4. Apply it to the test database, or every integration test breaks on the
   missing columns:
   `set -a; . ./.env.test; set +a; npx prisma migrate deploy`
5. `npm run typecheck && npm run lint && npm run test && npm run test:integration`
6. Commit the schema change and the generated migration folder together. A
   schema change without its migration will pass CI and then fail in production.
7. Merge `dev` into `main`. `main` has branch protection that expects a pull
   request.
8. Read the Vercel build log for the deployment and confirm the line
   `Applying migration <timestamp>_<name>`.

## Migration safety

- Additive nullable columns are safe and are what this project has used so far.
- A destructive change — dropping a column or table, adding `NOT NULL` to an
  existing column, changing a type — must be raised with the developer and
  explicitly approved before it is written. `prisma migrate deploy` has no
  rollback and there is no automated production backup.
- Never edit a migration that has already been merged to `main`. It has been
  applied to production and Prisma records its checksum; changing it makes
  every later deploy fail.
- Never run `prisma migrate reset` against anything other than `opengym_dev` or
  `opengym_test`. It drops the database.

## Reading production data

There is no local access to the production database. To inspect production
state, use the admin pages on the deployed site (`/admin`), the Vercel function
logs, or the Neon console — not a local Prisma client.
