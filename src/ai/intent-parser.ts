import { getAllGroups } from '../storage/index.js';

export interface ParsedIntent {
  action: 'post' | 'schedule' | 'add_group' | 'list_groups' | 'list_tasks' | 'cancel' | 'unknown';
  text?: string;
  mediaFiles?: string[];
  groupIds?: string[];
  groupCategories?: string[];
  schedule?: string;
}

export async function parseIntent(input: string): Promise<ParsedIntent> {
  const l = input.toLowerCase();

  if (l.includes('جدول') || l.includes('schedul') || l.includes('كل ') || l.includes('every ')) {
    return {
      action: 'schedule',
      text: extractText(input),
      mediaFiles: [],
      groupIds: await extractGroups(input),
      schedule: extractSchedule(input),
    };
  }

  if (l.includes('انشر') || l.includes('post') || l.includes('نشر')) {
    const schedule = extractSchedule(input);
    if (schedule) {
      return {
        action: 'schedule',
        text: extractText(input),
        mediaFiles: [],
        groupIds: await extractGroups(input),
        schedule,
      };
    }
    return {
      action: 'post',
      text: extractText(input),
      mediaFiles: [],
      groupIds: await extractGroups(input),
    };
  }

  if (l.includes('ضيف') || l.includes('add group') || l.includes('أضف')) {
    return { action: 'add_group', text: input };
  }

  if (l.includes('list groups') || l.includes('عرض المجموعات') || l.includes('groups')) {
    return { action: 'list_groups' };
  }

  if (l.includes('list tasks') || l.includes('المهام') || l.includes('tasks')) {
    return { action: 'list_tasks' };
  }

  return { action: 'unknown', text: input };
}

function extractSchedule(input: string): string | undefined {
  const l = input.toLowerCase();
  const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(ص|م|صباحاً|مساءً|am|pm)?/i);
  if (!timeMatch) return undefined;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const period = (timeMatch[3] || '').toLowerCase();

  if (period === 'م' || period === 'مساءً' || period === 'pm') {
    if (hours < 12) hours += 12;
  } else if (period === 'ص' || period === 'صباحاً' || period === 'am') {
    if (hours === 12) hours = 0;
  } else {
    if (hours < 6) hours += 12;
  }

  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  if (l.includes('كل') || l.includes('every')) {
    if (l.includes('جمعة') || l.includes('friday')) return `every friday at ${time}`;
    if (l.includes('سبت') || l.includes('saturday')) return `every saturday at ${time}`;
    if (l.includes('أحد') || l.includes('sunday')) return `every sunday at ${time}`;
    if (l.includes('اثنين') || l.includes('monday')) return `every monday at ${time}`;
    if (l.includes('ثلاثاء') || l.includes('tuesday')) return `every tuesday at ${time}`;
    if (l.includes('أربعاء') || l.includes('wednesday')) return `every wednesday at ${time}`;
    if (l.includes('خميس') || l.includes('thursday')) return `every thursday at ${time}`;
    if (l.includes('يوم') || l.includes('daily')) return `daily at ${time}`;
    return `daily at ${time}`;
  }

  if (l.includes('غداً') || l.includes('بكرا') || l.includes('tomorrow')) {
    return `tomorrow at ${time}`;
  }

  return `today at ${time}`;
}

async function extractGroups(input: string): Promise<string[] | undefined> {
  const l = input.toLowerCase();
  const allGroups = await getAllGroups();
  if (allGroups.length === 0) return undefined;

  const cats = [...new Set(allGroups.map(g => g.category))];
  for (const cat of cats) {
    if (cat && l.includes(cat.toLowerCase())) {
      return allGroups.filter(g => g.category === cat).map(g => g.url);
    }
  }

  for (const g of allGroups) {
    if (l.includes(g.name.toLowerCase())) {
      return [g.url];
    }
  }

  return allGroups.map(g => g.url);
}

function extractText(input: string): string {
  const cleaned = input
    .replace(/انشر|post|نشر|جدول|schedul|ضيف|add group|أضف|اليوم|today|النهاردة|غداً|بكرا|tomorrow|كل |every |الليلة|tonight|الساعة|at/gi, '')
    .replace(/\b(في|فى|في|el|al)\b/gi, '')
    .replace(/\d{1,2}:\d{2}\s*(ص|م|صباحاً|مساءً|am|pm)?/gi, '')
    .replace(/\d{1,2}\s*(ص|م|صباحاً|مساءً|am|pm)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || input;
}
