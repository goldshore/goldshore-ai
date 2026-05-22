# Workflow Backup Staging

Use this directory for temporary archival of workflow files during CI stabilization incidents.

Example:

```bash
mv .github/workflows/naming-lint.yml .github/workflows-backup/
```

Restore by moving the same file back into `.github/workflows/`.
