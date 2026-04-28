import { PrismaClient } from '@prisma/client';
import { type StoredDownloadJob, type IDownloadsRepository } from "./interfaces.js";
import { AppError } from "../store/errors.js";

export class PrismaDownloadsRepository implements IDownloadsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listDownloads(): Promise<StoredDownloadJob[]> {
    const jobs = await this.prisma.downloadJob.findMany({
      orderBy: { created_at: 'desc' }
    });
    return jobs.map(j => this.mapToStoredJob(j));
  }

  async getDownload(id: string): Promise<StoredDownloadJob | null> {
    const job = await this.prisma.downloadJob.findUnique({ where: { id } });
    return job ? this.mapToStoredJob(job) : null;
  }

  async saveDownload(job: StoredDownloadJob): Promise<StoredDownloadJob> {
    const data = {
      url: job.url,
      status: job.status,
      manga_title: job.manga_title,
      current_chapter: job.current_chapter,
      downloaded_pages: job.downloaded_pages,
      total_pages: job.total_pages,
      downloaded_chapters: job.downloaded_chapters,
      total_chapters: job.total_chapters,
      error: job.error,
      chapters_json: JSON.stringify(job.chapters),
      concurrency: job.concurrency,
      source_manga_id: job.source_manga_id,
      source_chapters_json: JSON.stringify(job.source_chapter_ids),
      source_title: job.source_title,
      source_provider_id: job.source_provider_id,
      terminal_reason: job.terminal_reason,
      updated_at: new Date(),
    };

    const updated = await this.prisma.downloadJob.upsert({
      where: { id: job.id },
      update: data,
      create: { ...data, id: job.id, created_at: new Date(job.created_at) }
    });

    return this.mapToStoredJob(updated);
  }

  async deleteDownload(id: string) {
    const deleted = await this.prisma.downloadJob.deleteMany({ where: { id } });
    if (deleted.count === 0) {
      throw new AppError(404, "download_not_found", "Download job not found");
    }
    return { status: "ok" };
  }

  private mapToStoredJob(job: any): StoredDownloadJob {
    return {
      id: job.id,
      url: job.url,
      status: job.status as any,
      manga_title: job.manga_title,
      current_chapter: job.current_chapter,
      downloaded_pages: job.downloaded_pages,
      total_pages: job.total_pages,
      downloaded_chapters: job.downloaded_chapters,
      total_chapters: job.total_chapters,
      error: job.error,
      chapters: JSON.parse(job.chapters_json || '[]'),
      concurrency: job.concurrency,
      source_manga_id: job.source_manga_id,
      source_chapter_ids: JSON.parse(job.source_chapters_json || '[]'),
      source_title: job.source_title,
      source_provider_id: job.source_provider_id,
      terminal_reason: job.terminal_reason,
      created_at: job.created_at.toISOString(),
      updated_at: job.updated_at.toISOString(),
    };
  }
}
