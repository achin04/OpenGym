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