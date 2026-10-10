# Safe merged-branch cleanup

When the user explicitly requests branch cleanup, delete only a non-default, unprotected branch after all of the following are verified:

1. Its related pull request is `MERGED`, or its commit is already fully integrated into the default branch.
2. No commits were added to the branch after the merged pull request.
3. No open pull request, active worktree, or current checkout uses the branch.
4. The default branch, protected branches, release branches, and branches with unresolved evidence are excluded.

Never delete `main`, `master`, the repository default branch, or any protected branch. Never force-push, rewrite history, delete a branch merely because it is old, or delete when verification is incomplete. Classify uncertain branches as `REVIEW REQUIRED` and report them instead.

After a verified cleanup, report the repository, branch, merge evidence, and whether the remote and/or local reference was removed.