import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function appendLoopLog(logsDir, filename, content) {
  await mkdir(logsDir, { recursive: true });
  await appendFile(path.join(logsDir, filename), `${content}\n`);
}
