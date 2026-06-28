/**
 * Commit messages follow Conventional Commits, and the scope must name the
 * workspace the change belongs to (the folder under apps/* or packages/*).
 * A handful of meta scopes cover repo-wide changes that don't map to one package.
 *
 * Examples: feat(web): ..., fix(api): ..., chore(repo): ...
 * Multiple scopes are allowed when a change genuinely spans packages: feat(email,api): ...
 */

// Workspace folders under apps/* and packages/*.
const workspaceScopes = ['api', 'web', 'common', 'content', 'email', 'headless', 'utils']

// Repo-wide changes that don't belong to a single workspace.
const metaScopes = ['repo', 'deps', 'ci', 'release']

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', [...workspaceScopes, ...metaScopes]],
    'scope-empty': [2, 'never'],
  },
}
