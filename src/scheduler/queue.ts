import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { config } from '../config/index.js';
import { getPendingTasks, getTask, updateTaskStatus, incrementTaskRetry } from '../storage/index.js';
import { postToGroups } from '../facebook/index.js';

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location!, destPath).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

export function startQueue(): void {
  if (running) return;
  running = true;
  processQueue();
  intervalId = setInterval(processQueue, config.scheduler.pollIntervalMs);
}

export function stopQueue(): void {
  running = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function processQueue(): Promise<void> {
  if (!running) return;
  try {
    const tasks = await getPendingTasks();
    for (const task of tasks) {
      if (!running) break;
      await executeTask(task.id);
    }
  } catch (err) {
    console.error('Queue error:', err);
  }
}

async function executeTask(taskId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task || task.status !== 'pending') return;

  await updateTaskStatus(taskId, 'running');

  try {
    const groupIds: string[] = typeof task.group_ids === 'string' ? JSON.parse(task.group_ids) : task.group_ids;
    const mediaRaw: string[] = typeof task.media_paths === 'string' ? JSON.parse(task.media_paths) : task.media_paths;

    const mediaDir = config.media.dir;
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

    const localMediaPaths: string[] = [];
    for (const item of mediaRaw) {
      if (item.startsWith('http://') || item.startsWith('https://')) {
        const ext = item.split('?')[0].split('.').pop() || 'jpg';
        const fileName = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const destPath = path.join(mediaDir, fileName);
        console.log(`Downloading: ${item}`);
        await downloadFile(item, destPath);
        localMediaPaths.push(destPath);
      } else {
        localMediaPaths.push(item);
      }
    }

    console.log(`Starting task ${taskId}: ${groupIds.length} groups, ${localMediaPaths.length} media files`);

    const results = await postToGroups(groupIds, task.text_content, localMediaPaths, taskId, (result, index, total) => {
      console.log(`[${index}/${total}] ${result.groupName}: ${result.success ? '✅' : '❌'}`);
    });

    const allSuccess = results.every(r => r.success);
    if (allSuccess) {
      await updateTaskStatus(taskId, 'done');
    } else {
      const failed = results.filter(r => !r.success);
      await incrementTaskRetry(taskId);
      if (task.retries + 1 >= task.max_retries) {
        await updateTaskStatus(taskId, 'failed', `${failed.length} groups failed`);
      } else {
        await updateTaskStatus(taskId, 'pending', `Retrying after ${failed.length} failures`);
      }
    }

    for (const p of localMediaPaths) {
      if (p.startsWith(mediaDir)) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Task ${taskId} failed:`, msg);
    await incrementTaskRetry(taskId);
    if (task.retries + 1 >= task.max_retries) {
      await updateTaskStatus(taskId, 'failed', msg);
    } else {
      await updateTaskStatus(taskId, 'pending', msg);
    }
  }
}
