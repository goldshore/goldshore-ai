# Agent Instructions

This file contains instructions for AI agents working in this repository.

## Commit / PR Description Requirement

At the top of every commit description (and corresponding PR description), include a short line that explicitly states whether the PR branch should be **merged** or **squashed**.

Example format:

* `Merge strategy: merge`
* `Merge strategy: squash`

## Build Configuration

All API services and workers must use the `gs-control` build token for Cloudflare Worker Builds. When updating build settings in the Cloudflare Dashboard, ensure that the token used corresponds to the `gs-control` service.

## Tagging for Review

To request a review of an error or issue, please use the following tags in your comments or pull request descriptions:

*   **@Jules-Bot `[review-request]`**: For a general code review.
*   **@Jules-Bot `[error-analysis]`**: For help in diagnosing and fixing a specific error.
*   **@Jules-Bot `[issue-repro]`**: For assistance in reproducing a reported issue.

Please provide as much context as possible when using these tags, including:

*   A clear description of the issue or the code to be reviewed.
*   Steps to reproduce the error or issue.
*   Any relevant logs or error messages.
*   The expected outcome.

## Commit / PR Description Header

At the top of every commit description or PR description, include a one-line merge strategy note that clearly states whether the branch should be merged with a standard merge commit or squashed.

Example:

*   `Merge Strategy: Squash`
*   `Merge Strategy: Merge Commit`
