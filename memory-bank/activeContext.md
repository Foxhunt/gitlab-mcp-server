# Active Context: GitLab MCP Server

## Current Work Focus

Implementing the core functionality of the GitLab MCP server, including:

- Implementing the `search` tool.
- Improving error handling.
- Adding the server to the MCP settings.

## Recent Changes

- Renamed `get_issue_comments` to `get_issue_notes`.
- Added basic pagination to `list_projects`.
- Added basic filtering to `get_issues`.
- Improved error handling.
- Added search tool.

## Next Steps

- add a schema declaration and validation library for request payloads and parameters Zod maybe

## Active Decisions and Considerations

- Using `axios` for making HTTP requests to the GitLab API.
- Using environment variables for API token and GitLab host.
- Focusing on read-only operations initially.
