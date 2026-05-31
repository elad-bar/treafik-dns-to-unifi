# Copy into your application repo

Your control-plane agent **treafik-dns-code-review** expects:

```text
.cursor/skills/code-review/SKILL.md
```

Optional (included in the run prompt if present):

```text
.cursor/skills/code-review/reference.md
```

## Manual install (treafik-dns-to-unifi)

From this folder, copy the tree into the GitHub repo:

```text
treafik-dns-to-unifi/
  .cursor/
    skills/
      code-review/
        SKILL.md
        reference.md   # optional
```

Commit and push, then run the agent with a **full** `headSha` (or `main`) for that commit.

After the skill exists, set the agent **Dry run** to **false** when you want a real SDK review.
