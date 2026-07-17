import { postToGroups } from '../../facebook/index.js';
import { createTask, getAllGroups, addHistory } from '../../storage/index.js';
import { MCPTool } from './registry.js';

export const postTool: MCPTool = {
  name: 'facebook_post',
  description: 'انشر منشور في مجموعات فيسبوك',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'نص المنشور' },
      mediaFiles: { type: 'array', items: { type: 'string' }, description: 'ملفات الصور/الفيديو' },
      groupIds: { type: 'array', items: { type: 'string' }, description: 'أيدي المجموعات أو روابطها' },
      groupCategories: { type: 'array', items: { type: 'string' }, description: 'تصنيفات المجموعات' },
    },
    required: ['text'],
  },
  handler: async (args) => {
    const text = String(args.text || '');
    const mediaFiles: string[] = (args.mediaFiles as string[]) || [];
    let groupIds: string[] = (args.groupIds as string[]) || [];
    const groupCategories: string[] = (args.groupCategories as string[]) || [];

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

    const task = createTask('post', groupIds, text, mediaFiles);
    const results = await postToGroups(groupIds, text, mediaFiles, task.id);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    let report = `📊 تقرير النشر:\n`;
    report += `✅ تم النشر بنجاح في ${successCount} مجموعة\n`;
    if (failCount) report += `❌ فشل في ${failCount} مجموعة\n`;

    results.forEach(r => {
      report += `\n${r.groupName}: ${r.success ? '✅' : '❌'}`;
      if (r.error) report += ` - ${r.error}`;
    });

    return { content: [{ type: 'text', text: report }] };
  },
};
