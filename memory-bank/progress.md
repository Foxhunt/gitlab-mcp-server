# Progress: GitLab MCP Server

## What Works

- Basic server setup with `@modelcontextprotocol/sdk`.
- `list_projects` tool implemented (with basic pagination).
- `get_issues` tool implemented (with basic filtering by state).
- `get_issue_notes` tool implemented.
- `search` tool implemented (basic functionality for `projects` and `issues` scopes).
- Basic error handling.
- Server added to MCP settings.
- `get_issue` tool implemented.
- `get_todos` tool implemented.
- `get_wiki_page` tool implemented.
- `list_wiki_pages` tool implemented.

## What's Left to Build

- Implement more filtering options for `get_issues` (e.g., labels, assignees, etc.).
- Implement pagination for `get_issues` and `get_issue_notes`.
- Add support for more scopes in the `search` tool (e.g., merge requests, milestones, etc.).
- Implement more robust error handling (specific error messages for different status codes).
- Add more comprehensive input validation.
- Add more tools as requested by the user.

## Current Status

The server is functional with basic read-only capabilities for projects, issues, and notes. The core structure is in place, and further development can focus on adding more features and improving robustness.

## Known Issues

- None at this time.
