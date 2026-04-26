import { readFile } from 'node:fs/promises';

import { buildAgentCommand } from './agent-command.mjs';

const PRESET_NAMES = ['codex', 'gemini'];

export function listAgentPresets() {
  return [...PRESET_NAMES];
}

export async function resolveAgentExecution(config, { promptFile }) {
  if (typeof config.agentCommandTemplate === 'string' && config.agentCommandTemplate.trim()) {
    const command = buildAgentCommand(config.agentCommandTemplate, { promptFile });

    return {
      mode: 'template',
      displayCommand: command,
      command,
      shell: true,
    };
  }

  const preset = `${config.agentPreset || ''}`.trim().toLowerCase();
  if (!preset) {
    return {
      mode: 'none',
      displayCommand: '',
      command: '',
      shell: true,
    };
  }

  if (preset === 'codex') {
    const command = buildAgentCommand('codex exec --prompt-file "{{PROMPT_FILE}}"', { promptFile });

    return {
      mode: 'preset',
      preset,
      displayCommand: command,
      command,
      shell: true,
    };
  }

  if (preset === 'gemini') {
    const prompt = await readFile(promptFile, 'utf8');

    return {
      mode: 'preset',
      preset,
      displayCommand: `gemini -p <contents of ${promptFile}> --yolo --skip-trust`,
      command: 'gemini',
      args: ['-p', prompt, '--yolo', '--skip-trust'],
      shell: false,
    };
  }

  throw new Error(`Unsupported Ralph loop agent preset: ${preset}`);
}
