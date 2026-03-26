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

const CreateIssueNoteArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  issueIid: z.string().describe("The internal ID of a project's issue"),
  body: z.string().describe("The content of the note/comment"),
  confidential: z.boolean().optional().describe("Deprecated: Scheduled to be removed in GitLab 16.0. Use 'internal' instead."),
  internal: z.boolean().optional().describe("The internal flag of a note. Overrides confidential. Default is false."),
  created_at: z.string().optional().describe("Date time string, ISO 8601 formatted. Example: 2016-03-11T03:45:40Z"),
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
      "The ID or URL-encoded path of the project owned by the authenticated user",
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

const CreateIssueArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  title: z.string().describe("The title of an issue"),
  description: z.string().optional().describe("The description of an issue"),
  assignee_ids: z.array(z.number()).optional().describe("The IDs of the users to assign the issue to"),
  labels: z.string().optional().describe("Comma-separated label names for an issue"),
  milestone_id: z.number().optional().describe("The global ID of a milestone to assign issue to"),
  confidential: z.boolean().optional().describe("Set an issue to be confidential"),
});

const EditIssueArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  issueIid: z.string().describe("The internal ID of a project's issue"),
  title: z.string().optional().describe("The title of an issue"),
  description: z.string().optional().describe("The description of an issue"),
  assignee_ids: z.array(z.number()).optional().describe("The IDs of the users to assign the issue to"),
  labels: z.string().optional().describe("Comma-separated label names for an issue"),
  state_event: z.enum(["close", "reopen"]).optional().describe("State event for an issue (close or reopen)"),
  confidential: z.boolean().optional().describe("Set an issue to be confidential"),
});

const ListMilestonesArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  state: z.enum(["active", "closed"]).optional().describe("Return only milestones with the given state"),
  search: z.string().optional().describe("Return milestones containing the search string"),
  page: z.number().optional().describe("Page number (default: 1)"),
});

const CreateBranchArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  branch: z.string().describe("Name for the new branch"),
  ref: z.string().describe("Branch name or commit SHA to create branch from"),
});

const CreateMergeRequestArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  source_branch: z.string().describe("The source branch"),
  target_branch: z.string().describe("The target branch"),
  title: z.string().describe("Title of MR"),
  description: z.string().optional().describe("Description of MR (e.g., 'Closes #123')"),
  assignee_id: z.number().optional().describe("Assignee user ID"),
});

const EditMergeRequestArgsSchema = z.object({
  projectId: z.string().describe("The ID or URL-encoded path of the project"),
  merge_request_iid: z.string().describe("The internal ID of the merge request"),
  target_branch: z.string().optional().describe("The target branch"),
  title: z.string().optional().describe("Title of MR"),
  description: z.string().optional().describe("Description of MR"),
  assignee_id: z.number().optional().describe("Assignee user ID"),
  state_event: z.enum(["close", "reopen"]).optional().describe("State event for the MR (close or reopen)"),
});

class GitlabServer {
  private server: McpServer;
  private axiosInstance;

  constructor() {
    this.server = new McpServer(
      {
        name: "gitlab-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {}, // Tools are now defined using server.registerTool()
        },
      },
    );

    this.axiosInstance = axios.create({
      baseURL: `${GITLAB_HOST}/api/v4`,
      headers: {
        "Private-Token": API_TOKEN,
      },
    });

    this.setupToolHandlers(); // Renamed for clarity, but now defines tools directly
    this.setupPrompts();
  }

  private setupPrompts() {
    this.server.registerPrompt(
      "gitlab_issue_to_mr",
      {
        title: "GitLab Issue to Merge Request Workflow",
        description:
          "Guides you through the full GitLab workflow: from an issue (new or existing) to a linked Draft Merge Request. " +
          "Provide a projectId and optionally an existing issueIid to skip issue creation.",
        argsSchema: {
          projectId: z.string().describe("The ID or URL-encoded path of the project"),
          issueIid: z
            .string()
            .optional()
            .describe("Optional IID of an existing issue. If omitted, a new issue will be created."),
        },
      },
      ({ projectId, issueIid }) => {
        const issueStep = issueIid
          ? `An existing issue (#${issueIid}) has been provided. ` +
            `First, call gitlab_get_issue with projectId="${projectId}" and issueIid="${issueIid}" to retrieve its details. ` +
            `If it needs a milestone, call gitlab_list_milestones to find one, then gitlab_edit_issue to assign it.`
          : `No existing issue was provided. Follow these steps:\n` +
            `1. Call gitlab_list_milestones with projectId="${projectId}" and state="active" to find an appropriate milestone.\n` +
            `2. Ask the user for a title and description for the new issue.\n` +
            `3. Call gitlab_create_issue with the projectId, title, description, and optionally the milestone_id from step 1.\n` +
            `4. Note the issue iid from the response.`;

        const branchAndMrSteps =
          `Once you have the issue iid, proceed as follows:\n` +
          `1. Create a branch: Call gitlab_create_branch with projectId="${projectId}", ` +
          `branch="<iid>-<short-description>" (e.g., "42-fix-login-bug"), and ref="dev".\n` +
          `2. Open a Draft Merge Request: Call gitlab_create_merge_request with projectId="${projectId}", ` +
          `source_branch (the branch you just created), target_branch="dev", ` +
          `title="Draft: Resolve #<iid> - <issue title>", and description="Closes #<iid>".\n` +
          `   Including "Closes #<iid>" ensures GitLab auto-closes the issue when the MR is merged.\n` +
          `3. Report the web_url of both the issue and the merge request to the user.`;

        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  `You are guiding the user through the GitLab Issue-to-Merge-Request workflow ` +
                  `for project "${projectId}".\n\n` +
                  `## Step 1: Establish the Issue\n${issueStep}\n\n` +
                  `## Step 2: Create Branch and Draft MR\n${branchAndMrSteps}`,
              },
            },
          ],
        };
      },
    );
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
            2,
          ),
        },
      ],
    };
  }

  private setupToolHandlers() {
    // Define tools using server.registerTool()
    this.server.registerTool(
      "gitlab_list_projects",
      {
        title: "List Projects",
        description: "List all projects (paginated)",
        inputSchema: ListProjectsArgsSchema,
      },
      async (args) => this.listProjects(args),
    );

    this.server.registerTool(
      "gitlab_get_issues",
      {
        title: "Get Issues",
        description: "Get issues for a project or globally (paginated)",
        inputSchema: GetIssuesArgsSchema,
      },
      async (args) => this.getIssues(args),
    );

    this.server.registerTool(
      "gitlab_get_issue_notes",
      {
        title: "Get Issue Notes",
        description: "Get notes for an issue (paginated)",
        inputSchema: GetIssueNotesArgsSchema,
      },
      async ({ projectId, issueIid, page }) =>
        this.getIssueNotes(projectId, issueIid, page),
    );

    this.server.registerTool(
      "gitlab_create_issue_note",
      {
        title: "Create Issue Note",
        description: "Create a new note/comment on an issue",
        inputSchema: CreateIssueNoteArgsSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false
        }
      },
      async (args) => this.createIssueNote(args),
    );

    this.server.registerTool(
      "gitlab_search",
      {
        title: "Search",
        description: "Search for projects, issues, merge requests, and more. (paginated)",
        inputSchema: SearchArgsSchema,
      },
      async ({ scope, search, projectId, page }) =>
        this.search(scope, search, projectId, page),
    );

    this.server.registerTool(
      "gitlab_get_issue",
      {
        title: "Get Issue",
        description: "Get a specific issue from a project",
        inputSchema: GetIssueArgsSchema,
      },
      async ({ projectId, issueIid }) => this.getIssue(projectId, issueIid),
    );

    this.server.registerTool(
      "gitlab_get_todos",
      {
        title: "Get Todos",
        description: "Get a list of to-do items (paginated)",
        inputSchema: GetTodosArgsSchema,
      },
      async (args) => this.getTodos(args),
    );

    this.server.registerTool(
      "gitlab_get_wiki_page",
      {
        title: "Get Wiki Page",
        description: "Get a wiki page for a given project",
        inputSchema: GetWikiPageArgsSchema,
      },
      async ({ projectId, slug, render_html, version }) =>
        this.getWikiPage(projectId, slug, render_html, version),
    );

    this.server.registerTool(
      "gitlab_list_wiki_pages",
      {
        title: "List Wiki Pages",
        description: "Get all wiki pages for a given project. (paginated)",
        inputSchema: ListWikiPagesArgsSchema,
      },
      async ({ projectId, with_content, page }) =>
        this.listWikiPages(projectId, with_content, page),
    );

    this.server.registerTool(
      "gitlab_create_issue",
      {
        title: "Create Issue",
        description: "Create a new issue in a project",
        inputSchema: CreateIssueArgsSchema,
      },
      async (args) => this.createIssue(args),
    );

    this.server.registerTool(
      "gitlab_edit_issue",
      {
        title: "Edit Issue",
        description: "Edit an existing issue in a project",
        inputSchema: EditIssueArgsSchema,
      },
      async (args) => this.editIssue(args),
    );

    this.server.registerTool(
      "gitlab_list_milestones",
      {
        title: "List Milestones",
        description: "Get a list of project milestones (paginated)",
        inputSchema: ListMilestonesArgsSchema,
      },
      async (args) => this.listMilestones(args),
    );

    this.server.registerTool(
      "gitlab_create_branch",
      {
        title: "Create Branch",
        description: "Create a new branch in the project",
        inputSchema: CreateBranchArgsSchema,
      },
      async (args) => this.createBranch(args),
    );

    this.server.registerTool(
      "gitlab_create_merge_request",
      {
        title: "Create Merge Request",
        description: "Create a new merge request",
        inputSchema: CreateMergeRequestArgsSchema,
      },
      async (args) => this.createMergeRequest(args),
    );

    this.server.registerTool(
      "gitlab_edit_merge_request",
      {
        title: "Edit Merge Request",
        description: "Update an existing merge request",
        inputSchema: EditMergeRequestArgsSchema,
      },
      async (args) => this.editMergeRequest(args),
    );
  }

  // --- Tool Implementation Methods ---

  private async listWikiPages(
    projectId: string,
    withContent?: boolean,
    page: number = 1,
  ) {
    try {
      const response = await this.axiosInstance.get(
        `projects/${encodeURIComponent(projectId)}/wikis`,
        {
          params: {
            with_content: withContent,
            page: page,
            per_page: 100,
          },
        },
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
    version?: string,
  ) {
    try {
      const response = await this.axiosInstance.get(
        `projects/${encodeURIComponent(projectId)}/wikis/${encodeURIComponent(slug)}`,
        {
          params: {
            render_html: render_html,
            version: version,
          },
        },
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
        `projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, // Ensure projectId is URL encoded
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
    page: number = 1,
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
        },
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
    page: number = 1,
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
        },
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

  private async createIssueNote(args: z.infer<typeof CreateIssueNoteArgsSchema>) {
    try {
      const { projectId, issueIid, ...data } = args;
      const response = await this.axiosInstance.post(
        `projects/${encodeURIComponent(projectId)}/issues/${issueIid}/notes`,
        data
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response.data, null, 2),
          },
        ],
        structuredContent: response.data
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async createIssue(args: z.infer<typeof CreateIssueArgsSchema>) {
    try {
      const { projectId, ...data } = args;
      const response = await this.axiosInstance.post(
        `projects/${encodeURIComponent(projectId)}/issues`,
        data
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

  private async editIssue(args: z.infer<typeof EditIssueArgsSchema>) {
    try {
      const { projectId, issueIid, ...data } = args;
      const response = await this.axiosInstance.put(
        `projects/${encodeURIComponent(projectId)}/issues/${issueIid}`,
        data
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

  private async listMilestones(args: z.infer<typeof ListMilestonesArgsSchema>) {
    try {
      const { projectId, ...params } = args;
      const response = await this.axiosInstance.get(
        `projects/${encodeURIComponent(projectId)}/milestones`,
        {
          params: {
            ...params,
            per_page: 100,
            page: args.page || 1,
          },
        },
      );
      return this.createPaginatedResponse(response.data, response.headers);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async createBranch(args: z.infer<typeof CreateBranchArgsSchema>) {
    try {
      const { projectId, ...data } = args;
      const response = await this.axiosInstance.post(
        `projects/${encodeURIComponent(projectId)}/repository/branches`,
        data
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

  private async createMergeRequest(args: z.infer<typeof CreateMergeRequestArgsSchema>) {
    try {
      const { projectId, ...data } = args;
      const response = await this.axiosInstance.post(
        `projects/${encodeURIComponent(projectId)}/merge_requests`,
        data
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

  private async editMergeRequest(args: z.infer<typeof EditMergeRequestArgsSchema>) {
    try {
      const { projectId, merge_request_iid, ...data } = args;
      const response = await this.axiosInstance.put(
        `projects/${encodeURIComponent(projectId)}/merge_requests/${merge_request_iid}`,
        data
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("GitLab MCP server running on stdio (using server.registerTool)"); // Updated log message
  }
}

const server = new GitlabServer();
server.run().catch(console.error);
