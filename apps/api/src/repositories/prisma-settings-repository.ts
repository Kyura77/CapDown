import { PrismaClient } from '@prisma/client';
import { type AppSettings } from "@capdown/contracts";
import { type ISettingsRepository } from "./interfaces.js";
import { encrypt, decrypt, isEncrypted } from "../utils/crypto.js";

export class PrismaSettingsRepository implements ISettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getSettings(): Promise<AppSettings & { updated_at?: string }> {
    const settings = await this.prisma.settings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' }
    });

    return {
      telegram_token: settings.telegram_token
        ? (isEncrypted(settings.telegram_token) ? decrypt(settings.telegram_token) : settings.telegram_token)
        : null,
      telegram_chat_id: settings.telegram_chat_id
        ? (isEncrypted(settings.telegram_chat_id) ? decrypt(settings.telegram_chat_id) : settings.telegram_chat_id)
        : null,
      enabled_providers: settings.enabled_providers_json
        ? JSON.parse(settings.enabled_providers_json)
        : undefined,
      updated_at: settings.updated_at.toISOString(),
    };
  }

  async setSettings(settings: Partial<AppSettings>): Promise<AppSettings & { updated_at?: string }> {
    const updated = await this.prisma.settings.update({
      where: { id: 'default' },
      data: {
        telegram_token: settings.telegram_token ? encrypt(settings.telegram_token) : undefined,
        telegram_chat_id: settings.telegram_chat_id ? encrypt(settings.telegram_chat_id) : undefined,
        enabled_providers_json: settings.enabled_providers
          ? JSON.stringify(settings.enabled_providers)
          : undefined,
      }
    });

    return {
      telegram_token: updated.telegram_token
        ? (isEncrypted(updated.telegram_token) ? decrypt(updated.telegram_token) : updated.telegram_token)
        : null,
      telegram_chat_id: updated.telegram_chat_id
        ? (isEncrypted(updated.telegram_chat_id) ? decrypt(updated.telegram_chat_id) : updated.telegram_chat_id)
        : null,
      enabled_providers: updated.enabled_providers_json
        ? JSON.parse(updated.enabled_providers_json)
        : undefined,
      updated_at: updated.updated_at.toISOString(),
    };
  }
}
