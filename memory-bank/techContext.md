# Tech Context: GitLab MCP Server

## Technologies Used

- **TypeScript:** The primary programming language.
- **Node.js:** The JavaScript runtime environment.
- **@modelcontextprotocol/sdk:** The Model Context Protocol SDK for building MCP
  servers.
- **axios:** A promise-based HTTP client for making requests to the GitLab API.
- **npm:** Package manager for installing dependencies.

## Development Setup

1. **Prerequisites:**

   - Node.js and npm installed.
   - A GitLab account and API token.
   - VS Code with the Claude-Dev extension.

2. **Project Setup:**

   - Create a new directory for the server: `mkdir gitlab-server`
   - Navigate to the directory: `cd gitlab-server`
   - Initialize a new Node.js project: `npm init -y`
   - Install dependencies: `npm install @modelcontextprotocol/sdk axios`
   - Create a `tsconfig.json` file for TypeScript configuration.
   - Create a `src/index.ts` file for the server implementation.

3. **Build:**

   - Use `npm run build` (which runs `tsc`) to compile the TypeScript code to
     JavaScript.

4. **Run:**

- The server will run automatically when added to the MCP settings in VS Code
  and when the extension is active.

## Technical Constraints

- The server must adhere to the Model Context Protocol specification.
- The server must handle potential rate limits imposed by the GitLab API.
- The server must handle authentication with the GitLab API securely.

## Dependencies

- `@modelcontextprotocol/sdk`: Provides the necessary classes and functions for
  building an MCP server.
- `axios`: Used for making HTTP requests to the GitLab API.
- `typescript`: Used for type checking and compiling to JavaScript.

## References

    - https://gitlab.com/gitlab-org/gitlab/-/tree/master/doc/api
    - https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/rest/_index.md
    - https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/rest/authentication.md
    - https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/projects.md
    - https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/issues.md
    - https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/notes.md
    - https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/issue_links.md
    - https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/search.md
    - https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/wikis.md
