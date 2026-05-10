# Contributing

## Workflow

- Create a feature branch off `main`.
  - Branch naming: `feat/<short-description>`, `fix/<short-description>`, `chore/<short-description>`
- Push the branch to origin.
- Open a Pull Request (PR) into `main`.
- Do not push directly to `main`.

## Local setup

```bash
pnpm install
cp .env.example .env
```

## Checks before opening a PR

```bash
pnpm lint
pnpm typecheck
pnpm -r --if-present build
```

## Commit messages

Keep commits small and descriptive. Recommended format:

- `feat: ...`
- `fix: ...`
- `chore: ...`
- `docs: ...`

## Repo settings (recommended)

In GitHub settings, enable branch protection for `main`:

- Require PRs before merging
- Require status checks to pass (lint/typecheck/build)
- Block force-pushes
- Optionally require 1 approving review
