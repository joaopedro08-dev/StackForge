# Contributing

Thanks for your interest in improving StackForge.

## Development Setup

1. Install dependencies:
   - pnpm install
2. Create local environment:
   - copy .env.example .env
3. Start in development:
   - pnpm dev

## Quality Gates

Before opening a pull request, run:

- pnpm lint
- pnpm test
- pnpm audit

## Branch Naming

Use descriptive branch names:

- feat/<short-description>
- fix/<short-description>
- chore/<short-description>
- docs/<short-description>

## Commit Messages

Follow Conventional Commits when possible:

- feat: add refresh token rotation metrics
- fix: handle missing csrf token in logout
- docs: update production checklist

## Pull Request Checklist

- Scope is small and focused.
- Tests cover behavior changes.
- Docs are updated when needed.
- No secrets or sensitive data are committed.

## Reporting Security Issues

Do not open public issues for vulnerabilities.
Please follow the process in SECURITY.md.
