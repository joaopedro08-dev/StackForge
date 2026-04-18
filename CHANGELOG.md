# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog,
and this project follows Semantic Versioning.

## Unreleased

### Added

- AuthForge branding across project metadata and docs.
- Professional repository standards:
  - CONTRIBUTING.md
  - SECURITY.md
  - CODE_OF_CONDUCT.md
  - issue and pull request templates
- Performance and maintenance scripts:
  - perf:docker:du
  - perf:docker:clean
  - perf:docker:clean:volumes
  - perf:docker:maintain
- Scaffolder language selection:
  - --lang=javascript|typescript
  - --ts shortcut
- Tooling and workspace configs:
  - prettier.config.cjs
  - tsconfig.json
  - turbo.json
  - vitest.config.mjs
  - vitest.workspace.mjs
  - .editorconfig
  - .prettierignore

### Changed

- Production commands now avoid rebuild by default.
- Production helper scripts and docs standardized to English.
- Log rotation configured in production compose using DOCKER_LOG_MAX_SIZE and DOCKER_LOG_MAX_FILE.

### Fixed

- Translation consistency in tests and user-facing script output.
- Scaffolder argument parsing and profile/language messaging.
