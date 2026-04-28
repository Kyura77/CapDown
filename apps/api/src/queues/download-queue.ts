import { Queue, Worker, type Job } from 'bullmq';
import type { IDownloadsRepository, ISettingsRepository, ILibraryRepository } from '../repositories/interfaces.js';
import { DownloadWorker, type DownloadPlan } from '../services/download-worker.js';

const QUEUE_NAME = 'capdown:downloads';

function redisConnection() {
  const url = process.env.CAPDOWN_REDIS_URL ?? 'redis://127.0.0.1:6379';
  const { hostname, port, password, pathname } = new URL(url);
  return {
    host: hostname,
    port: Number(port) || 6379,
    password: password || undefined,
    db: Number(pathname.slice(1)) || 0,
  };
}

export class DownloadQueue {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private readonly inProcess: DownloadWorker;

  constructor(
    downloadsRepo: IDownloadsRepository,
    settingsRepo: ISettingsRepository,
    libraryRepo: ILibraryRepository,
  ) {
    this.inProcess = new DownloadWorker(downloadsRepo, settingsRepo, libraryRepo);
  }

  async start(): Promise<void> {
    const connection = redisConnection();

    try {
      this.queue = new Queue(QUEUE_NAME, { connection });

      this.worker = new Worker<DownloadPlan>(
        QUEUE_NAME,
        (job: Job<DownloadPlan>) =>
          this.inProcess.processJob(job.data.jobId, job.data, (progress) =>
            job.updateProgress(progress),
          ),
        {
          connection,
          concurrency: 2,
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        },
      );

      this.worker.on('completed', (job) => console.log(`[queue] Job ${job.id} done`));
      this.worker.on('failed', (job, err) =>
        console.error(`[queue] Job ${job?.id} failed:`, err.message),
      );

      console.log('[queue] BullMQ started (Redis mode)');
    } catch {
      console.warn('[queue] Redis unavailable — falling back to in-process mode');
      this.queue = null;
    }
  }

  async enqueue(plan: DownloadPlan): Promise<void> {
    if (this.queue) {
      await this.queue.add(plan.jobId, plan, {
        jobId: plan.jobId,
        attempts: 2,
        backoff: { type: 'fixed', delay: 5_000 },
      });
    } else {
      void this.inProcess.processJob(plan.jobId, plan).catch((err) =>
        console.error(`[queue] In-process job ${plan.jobId} failed:`, err),
      );
    }
  }

  async remove(jobId: string): Promise<void> {
    const job = await this.queue?.getJob(jobId);
    await job?.remove();
    this.inProcess.cancelJob(jobId);
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
