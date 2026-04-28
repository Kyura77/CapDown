import { fetchWithTimeout } from '../utils/http.js';

export class TelegramBotService {
  private readonly botToken: string;

  constructor() {
    this.botToken = process.env.CAPDOWN_TELEGRAM_BOT_TOKEN || '';
  }

  isConfigured(): boolean {
    return this.botToken.length > 0;
  }

  /**
   * Uploads an image buffer as a document to preserve quality.
   */
  async sendDocument(buffer: Buffer, filename: string, chatId: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Telegram bot token is not configured in .env');
    }

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([new Uint8Array(buffer)]), filename);

    const url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      body: formData as any,
      timeoutMs: 60000, // 60s for file uploads
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Telegram API Error (${response.status}): ${text}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API Error: ${data.description}`);
    }

    // Return the file_id of the uploaded document
    return data.result.document.file_id;
  }

  /**
   * Gets the direct download URL for a file_id.
   * Note: The URL is valid for 1 hour.
   */
  async getFileUrl(fileId: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Telegram bot token is not configured in .env');
    }

    const url = `https://api.telegram.org/bot${this.botToken}/getFile?file_id=${fileId}`;
    const response = await fetchWithTimeout(url, { timeoutMs: 15000 });
    
    if (!response.ok) {
      throw new Error(`Telegram API getFile failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API Error: ${data.description}`);
    }

    const filePath = data.result.file_path;
    return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
  }
}

export const telegramBot = new TelegramBotService();
