---
description: GitLab workflow to progress from an issue to a Merge Request
---

# GitLab Issue to Merge Request Workflow

This workflow represents the standard process of taking an idea or bug through the GitLab pipeline, from planning to a Merge Request, using the GitLab MCP tools.

## Prerequisites
- Be aware of the target `projectId` (can be found using `gitlab_list_projects` or `gitlab_search`).
- Have the `gitlab-mcp-server` exposed in your environment constraints.

## Step 1: Identify Target Milestone (Optional)
If this work belongs to a specific release or plan, you should fetch the available milestones:
- Use `gitlab_list_milestones(projectId, state="active")` to find the relevant target `id` for the milestone.

## Step 2: Establish the Base Issue
You'll need an issue to coordinate discussions, labels, and track the state of the task in GitLab.

### Option A: Use an Existing Issue (Recommended if one exists)
1. Use `gitlab_get_issues` or `gitlab_search(scope="issues")` to find an open issue.
2. Note the issue's internal ID (`iid`).
3. If it is missing metadata, use `gitlab_edit_issue` to assign yourself and add a `milestone_id`.

### Option B: Create a New Issue
1. Create a brand new issue using `gitlab_create_issue`.
2. Provide `projectId`, a clear `title`, and optionally a `milestone_id` and `assignee_ids`.
3. Note the issue's `iid` from the response.

## Step 3: Create a Contextual Branch
GitLab merge requests require an isolated working branch to be created first:
- Use `gitlab_create_branch`.
- **projectId**: The ID of the project.
- **branch**: The name of your new branch. *Best Practice*: Prefix the branch name with the issue's `iid` so it's easily recognized (e.g., `<iid>-implement-feature`).
- **ref**: The base branch you want to pull changes from (e.g., `"dev"`).

## Step 4: Open a Linked Draft Merge Request
Once the branch is created, immediately open a Merge Request. This allows tracking the changes, pipeline status, and discussions concurrently as development progresses over a period of time.
- Use `gitlab_create_merge_request`.
- **projectId**: The ID of the project.
- **source_branch**: The branch you created in Step 3.
- **target_branch**: Your base branch (e.g., `"dev"`).
- **title**: Prefix with `Draft: ` indicating development is ongoing.
- **description**: Make sure to include the magic keyword `Closes #<iid>` anywhere in the body. When the MR is merged, GitLab will automatically close the linked issue for you.

## Step 5: Implement the Logic
Perform the actual code changes within your editor, commit them, and push. The Draft MR will automatically aggregate these commits.
