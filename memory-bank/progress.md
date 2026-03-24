# Progress: GitLab MCP Server

## What Works

- Basic server setup with `@modelcontextprotocol/sdk`.
- `gitlab_list_projects` tool implemented (with basic pagination).
- `gitlab_get_issues` tool implemented (with basic filtering by state).
- `gitlab_get_issue_notes` tool implemented.
- `gitlab_search` tool implemented (basic functionality for `projects` and `issues` scopes).
- Basic error handling.
- Server added to MCP settings.
- `gitlab_get_issue` tool implemented.
- `gitlab_get_todos` tool implemented.
- `gitlab_get_wiki_page` tool implemented (supports both numeric IDs and project path slugs).
- `gitlab_list_wiki_pages` tool implemented (supports both numeric IDs and project path slugs).
- `gitlab_create_issue` tool implemented.
- `gitlab_edit_issue` tool implemented.

## What's Left to Build

- Implement more filtering options for `gitlab_get_issues` (e.g., labels, assignees, etc.).
- Implement pagination for `gitlab_get_issues` and `gitlab_get_issue_notes`.
- Add support for more scopes in the `gitlab_search` tool (e.g., merge requests, milestones, etc.).
- Implement more robust error handling (specific error messages for different status codes).
- Add more comprehensive input validation.
- Add more tools as requested by the user.

## Current Status

The server is functional with basic read-only capabilities for projects, issues, and notes. The core structure is in place, and further development can focus on adding more features and improving robustness.

## Known Issues

- None at this time.

## Resolved Issues

- Fixed: `gitlab_get_wiki_page` and `gitlab_list_wiki_pages` were missing `encodeURIComponent()` on `projectId`, causing 404 errors when using project path slugs (e.g. `dahm/frontred`). Now both numeric IDs and URL-encoded paths work.
- Fixed: Deprecated `server.tool` was updated to `server.registerTool`. All tool names were prefixed with `gitlab_` to prevent namespace collisions, schemas are properly passed as direct Zod objects, and titles were added to tool definitions.
