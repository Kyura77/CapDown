import { loadApiEnv } from "@capdown/config";

export type ApiConfig = {
  host: string;
  port: number;
  scraperBaseUrl: string;
};

export function loadConfig(): ApiConfig {
  const env = loadApiEnv();

  return {
    host: env.CAPDOWN_V2_API_HOST,
    port: env.CAPDOWN_V2_API_PORT,
    scraperBaseUrl: env.CAPDOWN_V2_SCRAPER_URL,
  };
}
