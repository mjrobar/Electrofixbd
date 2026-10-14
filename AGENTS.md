# ElectrofixBD — Permanent Development Instructions

These rules apply to all future ElectrofixBD tasks and to the entire repository. They describe the required architecture and workflow; they do not imply that every component has already been implemented.

## 1. Project Architecture

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS 4.
- Backend: Node.js, TypeScript, Express.
- Database: Standard PostgreSQL using `pg` and version-controlled SQL migrations.
- Admin Panel: `/admin` in the same React application.
- Google AI Studio is the public frontend developer.
- OpenAI Codex is the backend and admin developer.
- Vercel and Supabase are temporary development/testing platforms only.
- Final production hosting will be Oracle ARM VM or compatible Node.js + PostgreSQL shared hosting.
- Frontend, backend, admin panel, and PostgreSQL must be deployable within the same hosting environment.
- Avoid Vercel- and Supabase-specific production dependencies.
- Do not migrate to Next.js without explicit approval.

## 2. File Ownership Rules

Google AI Studio owns:

- Public frontend pages and components.
- Website design, styling, typography, animations, and responsiveness.
- Public presentation and editorial content.

Codex owns:

- Backend APIs and business logic.
- PostgreSQL database access and migrations.
- Authentication and authorization.
- Admin panel and admin APIs.
- Backend tests and deployment configuration.

Rules:

1. Codex must not modify public frontend design without the user's approval.
2. Google AI Studio must not overwrite or modify Codex-owned backend files.
3. Changes to `package.json`, lockfiles, `src/App.tsx`, shared API contracts, frontend API clients, routing, and build configurations require special review.
4. If frontend changes require backend modifications, Google AI Studio will report the issue. Codex will resolve it, and Google AI Studio will re-import and verify the changes.
5. Preserve all existing functionality and avoid unrelated modifications.

## 3. Mandatory GitHub Workflow

Follow this exact process:

Codex Develop → GitHub Feature Branch → AI Studio Verify → Codex Fix (if needed) → PR Merge → Vercel Deploy.

- Always develop backend features in a dedicated branch.
- Never push backend development directly to `main`.
- Never automatically merge a Pull Request.
- Never force-push or overwrite unrelated frontend changes.
- AI Studio must verify compatibility before final merge.
- Review all modified files before merging.
- Run TypeScript, build, API, and relevant integration tests.
- Merge into `main` only after explicit user approval.
- The approved main branch triggers Vercel development deployment.

## 4. Google AI Studio Synchronization

- GitHub is the central source of truth.
- AI Studio can manually import files and changes from GitHub.
- Do not assume its workspace automatically synchronizes with GitHub.
- Preserve all existing frontend files when importing backend changes.
- Report any possible integration conflicts.
- AI Studio must verify backend compatibility after importing.
- Codex must fix reported backend problems in its feature branch.

## 5. Security and Data Integrity

- Never expose database credentials or server secrets in frontend code.
- Never use memory or localStorage as confirmed production booking persistence.
- Successful booking/contact responses must require durable PostgreSQL writes.
- Use secure admin authentication, sessions, authorization, CSRF protection, and input validation.
- Protect customer personal information.
- Use portable PostgreSQL migrations.
- Do not modify live databases or deploy without approval.

## 6. Backend Development Requirements

- Maintain one reusable Express application.
- Use a conventional Node.js production entrypoint.
- Keep Vercel as a thin development adapter.
- Use standard PostgreSQL access.
- Preserve existing public frontend functionality.
- Maintain compatible API contracts.
- Support deployment on qualified shared hosting and Oracle ARM VM.

## 7. Phase 2 Preparation

After creating AGENTS.md:

1. Confirm the file exists at the repository root.
2. Read and acknowledge its instructions.
3. Check the repository status.
4. Report the current branch.
5. Do not start Phase 2 implementation yet.
6. Do not modify unrelated application files.
7. Do not commit, push, merge, or deploy without approval.

Create this file in a dedicated branch or workspace, not directly on `main`.
