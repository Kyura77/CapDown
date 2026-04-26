import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_KEYS = [
  'projectRoot',
  'specPath',
  'planPath',
  'statePath',
  'logsDir',
  'systemPromptPath',
  'iterationPromptPath',
  'maxIterations',
  'dryRun',
];

export async function loadConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  const raw = await readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);

  const merged = {
    ...parsed,
    agentPreset: process.env.CAPDOWN_RALPH_AGENT_PRESET || parsed.agentPreset || '',
    agentCommandTemplate: process.env.CAPDOWN_RALPH_AGENT_CMD || parsed.agentCommandTemplate || '',
  };

  for (const key of REQUIRED_KEYS) {
    if (!(key in merged)) {
      throw new Error(`Missing Ralph loop config key: ${key}`);
    }
  }

  return merged;
}
