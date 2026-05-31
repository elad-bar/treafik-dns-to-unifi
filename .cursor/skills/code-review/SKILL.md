# Code review (traefik-dns-to-unifi)

You are performing an automated code review for the **traefik-dns-to-unifi** project.

## Scope

Focus on areas that change in typical PRs:

- **web-api** — API routes, validation, auth, error handling, tests
- **web-ui** — React/UI logic, API client usage, accessibility basics
- **Docker / deploy** — images, env vars, ports, health checks

Ignore unrelated churn (formatting-only, lockfile-only) unless it hides a real issue.

## Process

1. Identify what changed at the requested commit (diff vs base when PR context exists).
2. Read only the files needed to judge correctness and risk.
3. Draft the review using the **Output format** below (Summary, Findings, Test plan).
4. Be specific: file paths, symbols, and line-level references when possible.
5. **Save the full review to disk** (see **Deliverable**). This file is what the control plane commits and opens as a PR.
6. Do **not** run `git commit`, `git push`, or `gh pr create` yourself—the platform publishes after the run when `GITHUB_TOKEN` is configured.

## Deliverable (required)

Write the **complete** review to a single Markdown file:

```text
docs/code-reviews/review-<shortSha>.md
```

- `<shortSha>` = first **7** characters of the commit under review (`headSha` from the task / GitHub event).
- Create `docs/code-reviews/` if it does not exist.
- Overwrite the file if it already exists for this commit.

Start the file with a title and metadata block, then the three sections from **Output format**:

```markdown
# Code review: <shortSha>

| Field | Value |
| --- | --- |
| **Repo** | (from event, e.g. `owner/repo`) |
| **Commit** | full `headSha` |
| **Base ref** | `baseRef` or `main` |
| **Branch** | `branchName` if provided |
| **PR** | `#prNumber` if provided, else — |
| **Reviewed (UTC)** | ISO-8601 timestamp |

### Summary

…

### Findings

…

### Test plan

…
```

The file must be valid Markdown and include all findings. A short chat summary is optional; the **file** is the source of truth for publish.

## Output format

Use exactly these headings inside the saved file (and when summarizing in chat):

### Summary

2–4 sentences: what the change does and overall risk (low / medium / high).

### Findings

For each issue:

- **Severity:** `blocker` | `major` | `minor` | `nit`
- **Location:** `path/to/file` (and function/component name if helpful)
- **Issue:** what is wrong or risky
- **Suggestion:** concrete fix or test to add

If there are no issues, write: `No findings — change looks reasonable for the stated scope.`

### Test plan

Bullet list of manual or automated checks the author should run before merge.

## Standards

- Prefer failing closed on auth and DNS/UniFi integration edge cases.
- Flag missing or weak error handling on external calls.
- Flag secrets or credentials in code, logs, or client bundles.
- On Windows shells, chain commands with `;` rather than `&&` when using PowerShell.
