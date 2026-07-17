import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>;
}

export function registerTools(server: Server, tools: MCPTool[]): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
    return tool.handler(request.params.arguments ?? {});
  });
}
