#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const API_TOKEN = process.env.GITLAB_API_TOKEN;
const GITLAB_HOST =
  process.env.GITLAB_HOST || "https://projectbase.medien.hs-duesseldorf.de";

if (!API_TOKEN) {
  throw new Error("GITLAB_API_TOKEN environment variable is required");
}

const isValidListProjectsArgs = (args: any): args is {} =>
  typeof args === "object" && args !== null;

const isValidGetIssuesArgs = (args: any): args is { projectId: string } =>
  typeof args === "object" &&
  args !== null &&
  typeof args.projectId === "string";

const isValidGetIssueNotesArgs = (
  args: any
): args is { projectId: string; issueIid: string } =>
  typeof args === "object" &&
  args !== null &&
  typeof args.projectId === "string" &&
  typeof args.issueIid === "string";

const isValidSearchArgs = (
  args: any
): args is { scope: string; search: string } => {
  return (
    typeof args === "object" &&
    args !== null &&
    typeof args.scope === "string" &&
    typeof args.search === "string"
  );
};

class GitlabServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: "gitlab-server",
        version: "0.1.0",
        description: "Interact with a GitLab server",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: `${GITLAB_HOST}/api/v4`,
      headers: {
        "Private-Token": API_TOKEN,
      },
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_projects",
          description: "List all projects",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "get_issues",
          description: "Get issues for a project",
          inputSchema: {
            type: "object",
            properties: {
              projectId: {
                type: "string",
                description: "Project ID",
              },
            },
            required: ["projectId"],
          },
        },
        {
          name: "get_issue_notes",
          description: "Get notes for an issue",
          inputSchema: {
            type: "object",
            properties: {
              projectId: {
                type: "string",
                description: "Project ID",
              },
              issueIid: {
                type: "string",
                description: "Issue IID",
              },
            },
            required: ["projectId", "issueIid"],
          },
        },
        {
          name: "search",
          description: "Search for projects, issues, merge requests, and more.",
          inputSchema: {
            type: "object",
            properties: {
              scope: {
                type: "string",
                description:
                  "The scope to search in.  Values include `projects`, `issues`, `merge_requests`, `milestones`, `snippet_titles`, and `users`. Additional scopes are `wiki_blobs`, `commits`, `blobs`, and `notes`.",
                enum: [
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
                ],
              },
              search: {
                type: "string",
                description: "The search term.",
              },
            },
            required: ["scope", "search"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!request.params.arguments) {
        throw new McpError(ErrorCode.InvalidParams, "Arguments are required");
      }

      switch (request.params.name) {
        case "list_projects":
          if (!isValidListProjectsArgs(request.params.arguments)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid list_projects arguments"
            );
          }
          return this.listProjects();
        case "get_issues":
          if (!isValidGetIssuesArgs(request.params.arguments)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid get_issues arguments"
            );
          }
          return this.getIssues(request.params.arguments.projectId);
        case "get_issue_notes":
          if (!isValidGetIssueNotesArgs(request.params.arguments)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid get_issue_notes arguments"
            );
          }
          return this.getIssueNotes(
            request.params.arguments.projectId,
            request.params.arguments.issueIid
          );
        case "search":
          if (!isValidSearchArgs(request.params.arguments)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid search arguments"
            );
          }
          return this.search(
            request.params.arguments.scope,
            request.params.arguments.search
          );
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async search(scope: string, searchTerm: string) {
    try {
      const response = await this.axiosInstance.get("search", {
        params: {
          scope: scope,
          search: searchTerm,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message ?? error.message;
        let specificMessage = `GitLab API error: ${errorMessage}`;
        if (error.response?.status === 401) {
          specificMessage = "Unauthorized: Please check your GitLab API token.";
        } else if (error.response?.status === 403) {
          specificMessage =
            "Forbidden: You don't have permission to access this resource.";
        } else if (error.response?.status === 404) {
          specificMessage =
            "Not Found: The project, issue or note was not found.";
        }
        return {
          content: [{ type: "text", text: specificMessage }],
          isError: true,
        };
      }
      throw error;
    }
  }

  private async listProjects() {
    try {
      const response = await this.axiosInstance.get("projects", {
        params: {
          per_page: 100, // Use maximum page size
        },
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              response.data.map((project: any) => ({
                id: project.id,
                name: project.name,
                description: project.description,
                web_url: project.web_url,
              })),
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message ?? error.message;
        return {
          content: [
            { type: "text", text: `GitLab API error: ${errorMessage}` },
          ],
          isError: true,
        };
      } else {
        return {
          content: [
            { type: "text", text: `An unexpected error occurred: ${error}` },
          ],
          isError: true,
        };
      }
    }
  }

  private async getIssues(projectId: string) {
    try {
      const response = await this.axiosInstance.get(
        `projects/${projectId}/issues`,
        {
          params: {
            // Add basic filtering.  More can be added later if needed.
            state: "opened", // Default to opened issues
          },
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              response.data.map((issue: any) => ({
                iid: issue.iid,
                title: issue.title,
                description: issue.description,
                state: issue.state,
                web_url: issue.web_url,
              })),
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message ?? error.message;
        let specificMessage = `GitLab API error: ${errorMessage}`;
        if (error.response?.status === 401) {
          specificMessage = "Unauthorized: Please check your GitLab API token.";
        } else if (error.response?.status === 403) {
          specificMessage =
            "Forbidden: You don't have permission to access this resource.";
        } else if (error.response?.status === 404) {
          specificMessage = "Not Found: The project or issue was not found.";
        }
        return {
          content: [{ type: "text", text: specificMessage }],
          isError: true,
        };
      }
      throw error;
    }
  }

  private async getIssueNotes(projectId: string, issueIid: string) {
    try {
      const response = await this.axiosInstance.get(
        `projects/${projectId}/issues/${issueIid}/notes`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              response.data.map((note: any) => ({
                id: note.id,
                body: note.body,
                author: note.author.name,
                created_at: note.created_at,
              })),
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message ?? error.message;
        let specificMessage = `GitLab API error: ${errorMessage}`;
        if (error.response?.status === 401) {
          specificMessage = "Unauthorized: Please check your GitLab API token.";
        } else if (error.response?.status === 403) {
          specificMessage =
            "Forbidden: You don't have permission to access this resource.";
        } else if (error.response?.status === 404) {
          specificMessage =
            "Not Found: The project, issue or note was not found.";
        }
        return {
          content: [{ type: "text", text: specificMessage }],
          isError: true,
        };
      }
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("GitLab MCP server running on stdio");
  }
}

const server = new GitlabServer();
server.run().catch(console.error);
