# Operation: Risk Radar & Sentinel

Here is a clear set of instructions you can send to Codex and Jules to get your repositories back in order, install the Risk Radar app, and evaluate their work using a points‑based system. These steps assume you will run them in a GitHub environment with proper write access. They include both technical tasks and a scoring structure for accountability.

---

## 1. General Setup

* **Repositories in scope:**

  * `goldshore.github.io` (organization-level GitHub Pages site).
  * `astro-goldshore` (your main project site).
* **Goal:** Consolidate code, resolve merge conflicts (including the pnpm file conflicts), and install the Risk Radar app into both repositories without disrupting existing functionality.

---

## 2. Tasks for Codex

Codex should focus on the heavy lifting: cloning repos, resolving code issues, merging, and integrating the new app. Each item has a point value (positive points for success, negative points for delays or new conflicts).

1. **Clone and Inspect Repos**

   * Pull latest `main` branches of both repositories.
   * Generate a report of outstanding branches and open pull requests.
   * **Points:** +5 for completeness, −10 if missing branches or unmerged PRs.

2. **Audit Merge Conflicts**

   * Search across all branches for conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   * Identify the specific file(s) causing 300+ manual conflicts (likely the pnpm lock file).
   * **Points:** +10 for each resolved conflict file, −20 for any conflict left unresolved.

3. **Resolve the pnpm Lock Conflicts**

   * Determine which branch is the correct source of truth for the `pnpm` file.
   * Reconcile the conflicting versions, commit the final lock file, and push.
   * **Points:** +20 for full resolution, −30 for introducing new install errors.

4. **Consolidate Features**

   * Merge outstanding feature branches into `main` after conflicts are resolved.
   * Use interactive rebase or merge with commit messages indicating what was resolved.
   * **Points:** +10 per successful merge, −15 per failed merge requiring reversion.

5. **Install Risk Radar**

   * Create a subfolder at `/apps/risk-radar/` in each repo.
   * Add the PWA files (index.html, app.js, styles, manifest, service worker, assets).
   * Ensure relative paths in `manifest.webmanifest` and service worker are correct (`start_url` and `scope` set to `./`).
   * Add a link to the app in the root site navigation.
   * **Points:** +15 per repo if the PWA works without breaking existing content, −25 if it causes page build failures.

6. **Summary Report**

   * Provide a written summary of all changes made: conflict files, branches merged, files added, and any error logs.
   * Include commit hashes for traceability.
   * **Points:** +10 for clear, detailed summary, −10 if missing key details.

---

## 3. Tasks for Jules

Jules should concentrate on feature testing, security, and cross‑checking Codex’s work. Jules gets rewarded for finding issues and ensuring quality, and penalized for missing problems.

1. **Review Codex’s Conflict Resolutions**

   * Pull Codex’s updated branches.
   * Verify there are no remaining conflict markers.
   * Check `pnpm install` runs cleanly.
   * **Points:** +10 for each confirmed resolved conflict, −20 for each conflict still present.

2. **Security & Feature Audit**

   * Run a security scan (e.g. check for outdated packages, high‑risk deps).
   * Ensure there are no exposed secrets or misconfigured env files.
   * Check for broken features due to merges.
   * **Points:** +10 for each issue found and documented, +5 for each issue fixed, −15 if security warnings are ignored.

3. **Test Risk Radar Integration**

   * Navigate to `/apps/risk-radar/` on both repos’ GitHub Pages URLs and confirm:

     * It loads without 404s.
     * PWA service worker registers successfully.
     * Links from the root site to the app and back work.
   * File bug reports if anything breaks.
   * **Points:** +15 if the app works perfectly, −20 per major bug.

4. **Submit Feedback to Codex**

   * Provide constructive comments about conflicts, security fixes, and PWA performance.
   * Suggest improvements or highlight missed items.
   * **Points:** +5 for each useful suggestion, −10 if feedback is missing or unhelpful.

5. **Final Report**

   * Summarize findings, fixes applied, and highlight any remaining issues needing attention.
   * Include metrics on new features (like the Risk Radar app) and their performance.
   * **Points:** +10 for a detailed report, −10 if incomplete.

---

## 4. Collaboration Rules

* **Joint Accountability:** Codex and Jules must review each other’s work; failure to cross‑check will result in a **−50 point deduction** for both.
* **Confidentiality:** Avoid pushing changes with secrets, tokens, or untested code.
* **Communication:** Document and reference each commit so points are easy to track; for each significant change, they must mention the commit hash in their report.

---

## 5. Summary & Scoring

* **Starting Points:** Codex is at **−300**, Jules is neutral.
* **Bonus:** Delivering the fully working Risk Radar app in both repos without merge issues = **+100 points** each.
* **Penalties:** Introducing new merge conflicts, leaving errors unresolved, or ignoring partner feedback will incur heavy deductions (−50 or more, per incident).

---

## 6. Items Needed for Detailed Git Instructions

For these tasks, Codex and Jules will require:

1. **List of all branches:**
   (See `git branch -r` output in repo)
   - `main`
   - `feat/monorepo-restructure` (Likely source of truth for structure)
   - `feat/admin-app-scaffold`
   - `feat/module-*` (Active development)
   - `origin/jules/sentinel-*` (Automated updates)

2. **Any recent PRs:**
   Check GitHub Pull Requests tab for `is:open`.

3. **The PWA package (Risk Radar):**
   *Pending upload by user or Codex generation.*

4. **Correct `pnpm-lock.yaml` Source:**
   `main` is the primary source of truth. If `pnpm-lock.yaml` is conflicted, regenerate it using `pnpm install` from the root of `main`.

5. **Deployment environment details:**
   - Production: Cloudflare Pages (`gs-web`, `gs-admin`) / Workers.
   - Preview: `*-preview.goldshore.ai`.
