import { createTask, getAllGroups } from '../../storage/index.js';
import { parseNaturalSchedule, getNextRun } from '../../scheduler/cron.js';
import { MCPTool } from './registry.js';

export const scheduleTool: MCPTool = {
  name: 'facebook_schedule',
  description: 'جدول منشورات فيسبوك لوقت لاحق',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'نص المنشور' },
      mediaFiles: { type: 'array', items: { type: 'string' }, description: 'ملفات الصور/الفيديو' },
      groupIds: { type: 'array', items: { type: 'string' }, description: 'أيدي المجموعات' },
      groupCategories: { type: 'array', items: { type: 'string' }, description: 'تصنيفات المجموعات' },
      schedule: { type: 'string', description: 'الموعد (مثال: "كل جمعة الساعة 7م", "الغد 10:30ص")' },
    },
    required: ['text', 'schedule'],
  },
  handler: async (args) => {
    const text = String(args.text || '');
    const mediaFiles: string[] = (args.mediaFiles as string[]) || [];
    let groupIds: string[] = (args.groupIds as string[]) || [];
    const groupCategories: string[] = (args.groupCategories as string[]) || [];
    const scheduleStr = String(args.schedule || '');

    if (groupCategories.length) {
      const allGroups = getAllGroups();
      const filtered = allGroups.filter(g => groupCategories.includes(g.category));
      groupIds = [...groupIds, ...filtered.map(g => g.url)];
    }

    if (!groupIds.length) {
      const allGroups = getAllGroups();
      groupIds = allGroups.map(g => g.url);
    }

    if (!groupIds.length) {
      return { content: [{ type: 'text', text: 'لا توجد مجموعات. أضف مجموعات أولاً.' }] };
    }

    const parsed = parseNaturalSchedule(scheduleStr);
    if (!parsed) {
      return { content: [{ type: 'text', text: 'لم أفهم الموعد. استخدم مثال: "كل جمعة الساعة 7م"' }] };
    }

    const nextRun = getNextRun(parsed);
    const scheduledAt = nextRun.toISOString().replace('T', ' ').slice(0, 19);

    const task = createTask('post', groupIds, text, mediaFiles, scheduledAt);

    return {
      content: [{
        type: 'text',
        text: `📅 تم جدولة المنشور!\n📌 الموعد: ${scheduledAt}\n📋 رقم المهمة: ${task.id}\n👥 المجموعات: ${groupIds.length}`,
      }],
    };
  },
};
