import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";

// Create server instance
const server = new McpServer({
  name: "first-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  },
});

server.tool(
  "create-user",
  "Create a new user",
  {
    name: z.string(),
    email: z.string(),
  },
  {
    title: "Create User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const id = await createUser(params);
      return {
        content: [
          {
            type: "text",
            text: `User created with id: ${id}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Failed to create user`,
          },
        ],
      };
    }
  }
);

async function createUser(user: { name: string; email: string }) {
  const users = await import("./data/users.json", {
    with: { type: "json" },
  }).then((module) => module.default);
  const id = users.length + 1;
  users.push({ id, ...user });
  await fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2));
  return id;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
