import { PrismaClient } from '@prisma/client';
import { type AuthSession, type ProviderId } from "@capdown/contracts";
import { type IAuthRepository } from "./interfaces.js";

export class PrismaAuthRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listAuthAccounts() {
    const accounts = await this.prisma.authAccount.findMany();
    return accounts.map(a => ({
      provider_id: a.provider_id as ProviderId,
      username: a.username,
      password: a.password,
      created_at: a.created_at.toISOString(),
      updated_at: a.updated_at.toISOString(),
    }));
  }

  async upsertAuthAccount(account: { provider_id: ProviderId; username: string; password: string }) {
    return this.prisma.authAccount.upsert({
      where: {
        provider_id_username: {
          provider_id: account.provider_id,
          username: account.username,
        }
      },
      update: { password: account.password },
      create: {
        provider_id: account.provider_id,
        username: account.username,
        password: account.password,
      }
    });
  }

  async getAuthSession(providerId: string): Promise<AuthSession> {
    const session = await this.prisma.authSession.findUnique({
      where: { provider_id: providerId }
    });

    if (!session) {
      return { provider_id: providerId, connected: false };
    }

    return {
      provider_id: session.provider_id,
      connected: session.connected,
    };
  }

  async setAuthSession(providerId: string, session: Partial<AuthSession & { url?: string; wait_seconds?: number; last_solved_at?: string }>) {
    return this.prisma.authSession.upsert({
      where: { provider_id: providerId },
      update: {
        connected: session.connected,
        url: session.url,
        wait_seconds: session.wait_seconds,
        last_solved_at: session.last_solved_at ? new Date(session.last_solved_at) : undefined,
      },
      create: {
        provider_id: providerId,
        connected: session.connected ?? false,
        url: session.url,
        wait_seconds: session.wait_seconds,
        last_solved_at: session.last_solved_at ? new Date(session.last_solved_at) : undefined,
      }
    });
  }
}
