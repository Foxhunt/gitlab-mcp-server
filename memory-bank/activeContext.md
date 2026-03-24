# Active Context: GitLab MCP Server

## Current Work Focus

Implementing the core functionality of the GitLab MCP server, including:

- Implementing the `search` tool.
- Improving error handling.
- Adding the server to the MCP settings.

## Recent Changes

- Renamed `get_issue_comments` to `gitlab_get_issue_notes`.
- Added basic pagination to `gitlab_list_projects`.
- Added basic filtering to `gitlab_get_issues`.
- Improved error handling.
- Added `gitlab_search` tool.
- Added `gitlab_create_issue` and `gitlab_edit_issue` tools.
- Updated deprecated `server.tool` MCP API calls to `server.registerTool`.
- Prefixed all tools with `gitlab_` to adhere to MCP documentation best practices and avoid collisions.

## Next Steps

- add a schema declaration and validation library for request payloads and parameters Zod maybe

## Active Decisions and Considerations

- Using `axios` for making HTTP requests to the GitLab API.
- Using environment variables for API token and GitLab host.
- Focusing on read-only operations initially.
