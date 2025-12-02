#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"; // Import McpError and ErrorCode
import axios from "axios";
import { z } from "zod"; // Import Zod

const API_TOKEN = process.env.GITLAB_API_TOKEN;
const GITLAB_HOST = process.env.GITLAB_HOST;

if (!API_TOKEN) {
  throw new Error("GITLAB_API_TOKEN environment variable is required");
}

if (!GITLAB_HOST) {
  throw new Error("GITLAB_HOST environment variable is required");
}

// Zod Schemas for tool inputs
const GetIssuesArgsSchema = z.object({
  action: z
    .enum([
      "assigned",
      "mentioned",
      "build_failed",
      "marked",
      "approval_required",
      "unmergeable",
      "directly_addressed",
      "merge_train_removed",
      "member_access_requested",
    ])
    .optional()
    .describe("The action to be filtered."),
  author_id: z.number().optional().describe("The ID of an author"),
  project_id: z.number().optional().describe("The ID of a project"),
  group_id: z.number().optional().describe("The ID of a group"),
  state: z
    .enum(["pending", "done"])
    .optional()
    .describe("The state of the to-do item."),
  type: z
    .enum([
      "Issue",
      "MergeRequest",
      "Commit",
      "Epic",
      "DesignManagement::Design",
      "AlertManagement::Alert",
      "Project",
      "Namespace",
      "Vulnerability",
    ])
    .optional()
    .describe("The type of to-do item."),
  page: z.number().optional().describe("Page number (default: 1)"),
});

const GetIssueNotesArgsSchema = z.object({
  projectId: z.string().describe("Project ID"),
  issueIid: z.string().describe("Issue IID"),
  page: z.number().optional().describe("Page number (default: 1)"),
});

const SearchArgsSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe("Project ID to search within (optional)"),
  scope: z
    .enum([
      "projects",
      "issues",
      "merge_requests",
      "milestones",
      "snippet_titles",
      "users",
      "wiki_blobs",
      "commits",
      "blobs",
      "notes",
    ])
    .describe("The scope to search in."),
  search: z.string().describe("The search term."),
  page: z.number().optional().describe("Page number (default: 1)"),
});

const GetIssueArgsSchema = z.object({
  projectId: z
    .string()
    .describe(
      "The ID or URL-encoded path of the project owned by the authenticated user"
    ),
  issueIid: z.string().describe("The internal ID of a project's issue"),
});

const GetTodosArgsSchema = z.object({
  action: z
    .enum([
      "assigned",
      "mentioned",
      "build_failed",
      "marked",
      "approval_required",
      "unmergeable",
      "directly_addressed",
      "merge_train_removed",
      "member_access_requested",
    ])
    .optional()
    .describe("The action to be filtered."),
  author_id: z.number().optional().describe("The ID of an author"),
  project_id: z.number().optional().describe("The ID of a project"),
  group_id: z.number().optional().describe("The ID of a group"),
  state: z
    .enum(["pending", "done"])
    .optional()
    .describe("The state of the to-do item."),
  type: z
    .enum([
      "Issue",
      "MergeRequest",
      "Commit",
      "Epic",
      "DesignManagement::Design",
      "AlertManagement::Alert",
      "Project",
      "Namespace",
      "Vulnerability",
    ])
    .optional()
    .describe("The type of to-do item."),
  page: z.number().optional().describe("Page number (default: 1)"),
});

const GetWikiPageArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  slug: z.string().describe("URL encoded slug of the wiki page"),
  render_html: z.boolean().optional().describe("Render HTML of the page"),
  version: z.string().optional().describe("Wiki page version SHA"),
});

const ListWikiPagesArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  with_content: z.boolean().optional().describe("Include pages' content"),
  page: z.number().optional().describe("Page number (default: 1)"),
});

const ListProjectsArgsSchema = z.object({
  page: z.number().optional().describe("Page number (default: 1)"),
});

class GitlabServer {
  private server: McpServer;
  private axiosInstance;

  constructor() {
    this.server = new McpServer(
      {
        name: "gitlab-server",
        version: "0.1.0",
        description: "Interact with a GitLab server",
      },
      {
        capabilities: {
          tools: {}, // Tools are now defined using server.tool()
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: `${GITLAB_HOST}/api/v4`,
      headers: {
        "Private-Token": API_TOKEN,
      },
    });

    this.setupToolHandlers(); // Renamed for clarity, but now defines tools directly
  }

  // Centralized error handling for API calls
  private handleApiError(error: unknown) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message ?? error.message;
      let specificMessage = `GitLab API error: ${errorMessage}`;
      if (error.response?.status === 401) {
        specificMessage = "Unauthorized: Please check your GitLab API token.";
      } else if (error.response?.status === 403) {
        specificMessage =
          "Forbidden: You don't have permission to access this resource.";
      } else if (error.response?.status === 404) {
        specificMessage = "Not Found: The requested resource was not found.";
      }
      return {
        content: [{ type: "text" as const, text: specificMessage }],
        isError: true,
      };
    }
    // Re-throw unexpected errors
    console.error("Unexpected error:", error);
    return {
      content: [
        {
          type: "text" as const,
          text: `An unexpected error occurred: ${error}`,
        },
      ],
      isError: true,
    };
  }

  private createPaginatedResponse(data: any, headers: any) {
    const page = parseInt(headers["x-page"] || "1", 10);
    const perPage = parseInt(headers["x-per-page"] || "20", 10);
    const totalPages = parseInt(headers["x-total-pages"] || "0", 10);
    const totalItems = parseInt(headers["x-total"] || "0", 10);
    const nextPage = parseInt(headers["x-next-page"] || "0", 10);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              data,
              pagination: {
                current_page: page,
                per_page: perPage,
                total_pages: totalPages > 0 ? totalPages : undefined,
                total_items: totalItems > 0 ? totalItems : undefined,
                next_page: nextPage > 0 ? nextPage : undefined,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private setupToolHandlers() {
    // Define tools using server.tool()
    this.server.tool(
      "list_projects",
      "List all projects (paginated)",
      ListProjectsArgsSchema.shape,
      async (args) => this.listProjects(args)
    );

    this.server.tool(
      "get_issues",
      "Get issues for a project or globally (paginated)",
      GetIssuesArgsSchema.shape,
      async (args) => this.getIssues(args)
    );

    this.server.tool(
      "get_issue_notes",
      "Get notes for an issue (paginated)",
      GetIssueNotesArgsSchema.shape,
      async ({ projectId, issueIid, page }) =>
        this.getIssueNotes(projectId, issueIid, page)
    );

    this.server.tool(
      "search",
      "Search for projects, issues, merge requests, and more. (paginated)",
      SearchArgsSchema.shape,
      async ({ scope, search, projectId, page }) =>
        this.search(scope, search, projectId, page)
    );

    this.server.tool(
      "get_issue",
      "Get a specific issue from a project",
      GetIssueArgsSchema.shape,
      async ({ projectId, issueIid }) => this.getIssue(projectId, issueIid)
    );

    this.server.tool(
      "get_todos",
      "Get a list of to-do items (paginated)",
      GetTodosArgsSchema.shape,
      async (args) => this.getTodos(args)
    );

    this.server.tool(
      "get_wiki_page",
      "Get a wiki page for a given project",
      GetWikiPageArgsSchema.shape,
      async ({ projectId, slug, render_html, version }) =>
        this.getWikiPage(projectId, slug, render_html, version)
    );

    this.server.tool(
      "list_wiki_pages",
      "Get all wiki pages for a given project. (paginated)",
      ListWikiPagesArgsSchema.shape,
      async ({ projectId, with_content, page }) =>
        this.listWikiPages(projectId, with_content, page)
    );
  }

  // --- Tool Implementation Methods ---

  private async listWikiPages(
    projectId: string,
    withContent?: boolean,
    page: number = 1
  ) {
    try {
      const response = await this.axiosInstance.get(
        `projects/${projectId}/wikis`,
        {
          params: {
            with_content: withContent,
            page: page,
            per_page: 100,
          },
        }
      );
      return this.createPaginatedResponse(response.data, response.headers);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async getTodos(args: z.infer<typeof GetTodosArgsSchema>) {
    try {
      const response = await this.axiosInstance.get("todos", {
        params: {
          ...args,
          page: args.page || 1,
          per_page: 100,
        },
      });

      return this.createPaginatedResponse(response.data, response.headers);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async getWikiPage(
    projectId: string,
    slug: string,
    render_html?: boolean,
    version?: string
  ) {
    try {
      const response = await this.axiosInstance.get(
        `projects/${projectId}/wikis/${encodeURIComponent(slug)}`, // Ensure slug is URL encoded
        {
          params: {
            render_html: render_html,
            version: version,
          },
        }
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async getIssue(projectId: string, issueIid: string) {
    try {
      const response = await this.axiosInstance.get(
        `projects/${encodeURIComponent(projectId)}/issues/${issueIid}` // Ensure projectId is URL encoded
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async search(
    scope: string,
    searchTerm: string,
    projectId?: string,
    page: number = 1
  ) {
    try {
      const response = await this.axiosInstance.get(
        projectId
          ? `projects/${encodeURIComponent(projectId)}/search`
          : "search", // Ensure projectId is URL encoded
        {
          params: {
            scope: scope,
            search: searchTerm,
            page: page,
            per_page: 100,
          },
        }
      );

      return this.createPaginatedResponse(response.data, response.headers);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async listProjects(args: z.infer<typeof ListProjectsArgsSchema>) {
    try {
      const response = await this.axiosInstance.get("projects", {
        params: {
          per_page: 100, // Use maximum page size
          page: args.page || 1,
          order_by: "id", // Consistent ordering
          sort: "asc",
          simple: true, // Use simple representation for efficiency
        },
      });

      const projects = response.data.map((project: any) => ({
        // Map simplified project data
        id: project.id,
        name: project.name,
        web_url: project.web_url,
        path_with_namespace: project.path_with_namespace, // Often useful
      }));

      return this.createPaginatedResponse(projects, response.headers);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async getIssues(args: z.infer<typeof GetIssuesArgsSchema>) {
    try {
      const endpoint = args.project_id
        ? `projects/${args.project_id}/issues`
        : "issues"; // Allow fetching all accessible issues if no project_id

      const params = {
        ...args,
        per_page: 100,
        page: args.page || 1,
      };
      delete params.project_id; // Remove project_id if it was used for endpoint selection

      const response = await this.axiosInstance.get(endpoint, {
        params: params,
      });

      const issues = response.data.map((issue: any) => ({
        // Select relevant fields
        id: issue.id,
        iid: issue.iid,
        project_id: issue.project_id,
        title: issue.title,
        state: issue.state,
        web_url: issue.web_url,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        author: issue.author?.username, // Optional chaining
        assignees: issue.assignees?.map((a: any) => a.username), // Optional chaining
        labels: issue.labels,
      }));

      return this.createPaginatedResponse(issues, response.headers);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async getIssueNotes(
    projectId: string,
    issueIid: string,
    page: number = 1
  ) {
    try {
      const response = await this.axiosInstance.get(
        `projects/${encodeURIComponent(projectId)}/issues/${issueIid}/notes`, // Ensure projectId is URL encoded
        {
          params: {
            per_page: 100,
            page: page,
            sort: "asc", // Get notes in chronological order
            order_by: "created_at",
          },
        }
      );

      const notes = response.data.map((note: any) => ({
        id: note.id,
        body: note.body,
        author: note.author.username, // Use username
        created_at: note.created_at,
        updated_at: note.updated_at,
        system: note.system, // Indicate if it's a system note
        resolvable: note.resolvable,
        confidential: note.confidential,
      }));

      return this.createPaginatedResponse(notes, response.headers);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("GitLab MCP server running on stdio (using server.tool)"); // Updated log message
  }
}

const server = new GitlabServer();
server.run().catch(console.error);
