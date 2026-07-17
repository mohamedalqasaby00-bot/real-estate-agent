import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/registry.js';
import { postTool } from './tools/post.js';
import { scheduleTool } from './tools/schedule.js';
import { listGroupsTool, addGroupTool, listTasksTool } from './tools/facebook.js';

export function createMCPServer(): Server {
  const server = new Server(
    { name: 'real-estate-agent', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  registerTools(server, [
    postTool,
    scheduleTool,
    listGroupsTool,
    addGroupTool,
    listTasksTool,
  ]);

  return server;
}

export async function startMCPServer(): Promise<void> {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('🤖 MCP server ready (stdio)');
}
