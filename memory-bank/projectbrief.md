# Project Brief: GitLab MCP Server

## Overview

This project aims to create a Model Context Protocol (MCP) server that interacts with a self-hosted GitLab instance. The server will provide tools to fetch and manage GitLab data, specifically projects, issues, and issue notes (comments).

## Goals

- Provide tools to list projects accessible to the user.
- Provide tools to get issues for a specific project.
- Provide tools to get notes (comments) for a specific issue.
- Provide a tool to search for projects and issues.
- Authenticate with the GitLab API using a user-provided API token.
- Handle potential errors from the GitLab API gracefully.
- Follow MCP server development best practices.

## Scope

The initial scope includes read-only access to projects, issues, and notes. Future enhancements could include write access (creating issues, adding comments, etc.) and support for additional GitLab resources (merge requests, milestones, etc.).
