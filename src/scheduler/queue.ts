import { config } from '../config/index.js';
import { getPendingTasks, getTask, updateTaskStatus, incrementTaskRetry } from '../storage/index.js';
import { postToGroups } from '../facebook/index.js';

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

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
    const tasks = getPendingTasks();
    for (const task of tasks) {
      if (!running) break;
      await executeTask(task.id);
    }
  } catch (err) {
    console.error('Queue error:', err);
  }
}

async function executeTask(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task || task.status !== 'pending') return;

  updateTaskStatus(taskId, 'running');

  try {
    const groupIds: string[] = JSON.parse(task.group_ids);
    const mediaPaths: string[] = JSON.parse(task.media_paths);

    const results = await postToGroups(groupIds, task.text_content, mediaPaths, taskId, (result, index, total) => {
      console.log(`[${index}/${total}] ${result.groupName}: ${result.success ? '✅' : '❌'}`);
    });

    const allSuccess = results.every(r => r.success);
    if (allSuccess) {
      updateTaskStatus(taskId, 'done');
    } else {
      const failed = results.filter(r => !r.success);
      incrementTaskRetry(taskId);
      if (task.retries + 1 >= task.max_retries) {
        updateTaskStatus(taskId, 'failed', `${failed.length} groups failed`);
      } else {
        updateTaskStatus(taskId, 'pending', `Retrying after ${failed.length} failures`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    incrementTaskRetry(taskId);
    if (task.retries + 1 >= task.max_retries) {
      updateTaskStatus(taskId, 'failed', msg);
    } else {
      updateTaskStatus(taskId, 'pending', msg);
    }
  }
}
