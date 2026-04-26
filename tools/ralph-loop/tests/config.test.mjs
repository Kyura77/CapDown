import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadConfig } from '../lib/config.mjs';

test('loadConfig merges file config with environment command override', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ralph-config-'));
  const configPath = path.join(dir, 'config.json');
  const previousAgentCommand = process.env.CAPDOWN_RALPH_AGENT_CMD;

  await writeFile(configPath, JSON.stringify({
    projectRoot: '.',
    specPath: 'spec.md',
    planPath: 'plan.md',
    statePath: 'state.json',
    logsDir: 'logs',
    systemPromptPath: 'system.md',
    iterationPromptPath: 'iteration.md',
    agentPreset: 'codex',
    agentCommandTemplate: 'from-file',
    maxIterations: 3,
    dryRun: true,
  }, null, 2));

  process.env.CAPDOWN_RALPH_AGENT_CMD = 'from-env';

  try {
    const config = await loadConfig(configPath);

    assert.equal(config.agentCommandTemplate, 'from-env');
    assert.equal(config.agentPreset, 'codex');
    assert.equal(config.maxIterations, 3);
    assert.equal(config.dryRun, true);
  } finally {
    if (previousAgentCommand === undefined) {
      delete process.env.CAPDOWN_RALPH_AGENT_CMD;
    } else {
      process.env.CAPDOWN_RALPH_AGENT_CMD = previousAgentCommand;
    }
  }
});
