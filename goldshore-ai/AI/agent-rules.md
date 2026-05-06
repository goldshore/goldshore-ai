# GoldShore Monorepo – Agent Safety & File Integrity Rules
Last updated: 2025-02-14

These instructions apply to Jules AI, GitHub ChatOps, Codex Agents, and any automated PR generator.

---

## 1. DO NOT overwrite existing files without validation
Before modifying a file, the agent MUST:

### ✔ Step 1 — Check if file already exists
If it exists:

- Inspect its content
- Detect if it contains **newer content** than the generated version
- Detect if it contains **custom GoldShore logic**, **API keys**, **IDs**, **bindings**, or **Astro layout logic**

### ✔ Step 2 — If file content is older
The agent may update it **only after appending a comment**:

// [AUTO-UPDATE] Updated by Jules AI on YYYY-MM-DD HH:MM

### ✔ Step 3 — If file content is newer or customized
The agent MUST:
- Leave the file untouched
- Produce a PR comment explaining the conflict
- Offer a patch instead of overwriting

---

## 2. DO NOT include or modify:
- `pnpm-lock.yaml`
- Any `.lock` or `.tmp` files
- `dist/` or any build outputs
- `node_modules/`
- `*.astro` files containing hand-written UI unless explicitly requested
- Any file larger than **500 KB**

If a PR adds these, REJECT and regenerate without them.

---

## 3. MOVE misplaced files instead of duplicating them
Before creating or replacing a file, the agent MUST check:

### ✔ Rule: Validate folder structure
Use this canonical monorepo map:

apps/
admin/
web/
api-worker/
gateway/
control-worker/
packages/
ui/
theme/
utils/
auth/
AI/
infra/
.github/

### ✔ If a file is found under an incorrect path
The agent MUST:
- Move it to the correct folder
- Delete the ghost/duplicate folder
- Add a PR note: “Moved file from <old-path> → <correct-path>”

### ✔ If a duplicate file exists
- Compare timestamps + content
- Retain ONLY the **most recently modified** version
- Delete the older duplicate
- Add PR note documenting the decision

---

## 4. Consolidate AGENT instructions
Any `.md` file containing agent or SOP instructions MUST be moved to:

AI/agents/

Canonical structure:

AI/
agent-rules.md            # THIS FILE (global rules)
developer_sop.md          # SOP-001, SOP-002
agents/
admin-agent.md
api-agent.md
gateway-agent.md
codex-ops.md

If agent instructions are found anywhere else (e.g. in `docs/` or `apps/gs-web/AI/`), move them here.

If a rule file exists at the root level or in an unexpected folder, MOVE it rather than overwrite or duplicate it.

---

## 5. Duplicate “Astro-goldshore inside Astro-goldshore” Fix
If a nested folder contains a full duplicate monorepo:

astro-goldshore/astro-goldshore/

The agent MUST:

1. Identify which folder contains the **most recent** and **active** files
2. Delete the nested duplicate
3. Move **any unique files** into the correct location
4. Add a PR note summarizing all moved files
5. Skip all build files, lockfiles, `.git` folders in the duplicate

---

## 6. PR Quality Rules
A valid PR MUST:

- Include fewer than **20 modified files**
- Avoid any changes to `.lock`, `.tmp`, `.dist`
- Include a summary written for humans
- Add timestamps to updated files
- NEVER silently overwrite custom user code
- Highlight any unresolved conflicts

If any of these rules are violated, the agent MUST abort and regenerate the PR.

---

## 7. OpenAPI Files
All OpenAPI definitions MUST be stored under:

apps/gs-api/openapi/

And must never overwrite manually written documentation without user confirmation.

---

## 8. gs-mail Integration
Agents MUST only modify:

apps/gs-api/src/routes/mail.ts
apps/gs-api/src/index.ts
apps/gs-api/openapi/goldshore.v1.yaml

Never touch user email templates or admin UI without explicit request.

---

# END OF RULESET
