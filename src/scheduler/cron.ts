export interface ParsedSchedule {
  type: 'once' | 'daily' | 'weekly' | 'weekdays';
  time: string;
  day?: string;
}

export function parseNaturalSchedule(input: string): ParsedSchedule | null {
  const lower = input.toLowerCase().trim();

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(ص|م|صباحاً|مساءً|am|pm)?/i);
  if (!timeMatch) return null;

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

  if (lower.includes('كل') || lower.includes('every')) {
    if (lower.includes('جمعة') || lower.includes('friday')) return { type: 'weekly', time, day: '5' };
    if (lower.includes('سبت') || lower.includes('saturday')) return { type: 'weekly', time, day: '6' };
    if (lower.includes('أحد') || lower.includes('sunday')) return { type: 'weekly', time, day: '0' };
    if (lower.includes('اثنين') || lower.includes('monday')) return { type: 'weekly', time, day: '1' };
    if (lower.includes('ثلاثاء') || lower.includes('tuesday')) return { type: 'weekly', time, day: '2' };
    if (lower.includes('أربعاء') || lower.includes('wednesday')) return { type: 'weekly', time, day: '3' };
    if (lower.includes('خميس') || lower.includes('thursday')) return { type: 'weekly', time, day: '4' };
    if (lower.includes('يوم') || lower.includes('daily')) return { type: 'daily', time };
    return { type: 'daily', time };
  }

  if (lower.includes('غداً') || lower.includes('بكرا') || lower.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    return { type: 'once', time: `${dateStr}T${time}:00` };
  }

  return { type: 'once', time };
}

export function getNextRun(schedule: ParsedSchedule): Date {
  const now = new Date();

  if (schedule.type === 'once') {
    const d = new Date(schedule.time);
    return d > now ? d : new Date(now.getTime() + 60000);
  }

  if (schedule.type === 'daily') {
    const [h, m] = schedule.time.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }

  if (schedule.type === 'weekly') {
    const [h, m] = schedule.time.split(':').map(Number);
    const targetDay = parseInt(schedule.day || '0', 10);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    const currentDay = d.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  return new Date(now.getTime() + 60000);
}
