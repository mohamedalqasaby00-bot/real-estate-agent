import { getAllGroups, addGroup, deleteGroup, getGroup, getAllTasks } from '../../storage/index.js';
import { MCPTool } from './registry.js';

export const listGroupsTool: MCPTool = {
  name: 'facebook_list_groups',
  description: 'عرض كل مجموعات فيسبوك المخزنة',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async () => {
    const groups = getAllGroups();
    if (!groups.length) {
      return { content: [{ type: 'text', text: 'لا توجد مجموعات. استخدم add_group لإضافة مجموعة.' }] };
    }

    let text = `📋 مجموعات فيسبوك (${groups.length}):\n`;
    groups.forEach(g => {
      text += `\n- ${g.name} (${g.category || 'بدون تصنيف'})`;
    });

    return { content: [{ type: 'text', text }] };
  },
};

export const addGroupTool: MCPTool = {
  name: 'facebook_add_group',
  description: 'إضافة مجموعة فيسبوك جديدة',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'اسم المجموعة' },
      url: { type: 'string', description: 'رابط المجموعة' },
      category: { type: 'string', description: 'تصنيف المجموعة (اختياري)' },
    },
    required: ['name', 'url'],
  },
  handler: async (args) => {
    const name = String(args.name || '');
    const url = String(args.url || '');
    const category = String(args.category || '');

    const existing = getAllGroups().find(g => g.url === url);
    if (existing) {
      return { content: [{ type: 'text', text: `المجموعة "${name}" موجودة مسبقاً.` }] };
    }

    addGroup(name, url, category);
    return { content: [{ type: 'text', text: `✅ تم إضافة المجموعة: ${name}` }] };
  },
};

export const listTasksTool: MCPTool = {
  name: 'facebook_list_tasks',
  description: 'عرض كل المهام المجدولة',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    const tasks = getAllTasks().filter(t => t.status !== 'done');
    if (!tasks.length) {
      return { content: [{ type: 'text', text: 'لا توجد مهام حالية.' }] };
    }

    let text = `📋 المهام (${tasks.length}):\n`;
    tasks.forEach(t => {
      text += `\n- ${t.id.slice(0, 8)}... | ${t.status}`;
      if (t.scheduled_at) text += ` | مجدولة: ${t.scheduled_at}`;
    });

    return { content: [{ type: 'text', text }] };
  },
};
