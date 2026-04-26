function sanitizePromptFileForCommandTemplate(promptFile) {
  if (typeof promptFile !== 'string' || !promptFile.trim()) {
    throw new Error('Missing promptFile');
  }

  if (promptFile.includes('"') || promptFile.includes('\r') || promptFile.includes('\n')) {
    throw new Error('Prompt file contains unsupported characters for command template injection');
  }

  return promptFile.replaceAll('%', '%%');
}

export function buildAgentCommand(template, { promptFile }) {
  if (!template || !template.trim()) {
    throw new Error('Missing CAPDOWN_RALPH_AGENT_CMD or config agentCommandTemplate');
  }

  if (!template.includes('{{PROMPT_FILE}}')) {
    throw new Error('Missing {{PROMPT_FILE}} placeholder in agent command template');
  }

  return template.replace('{{PROMPT_FILE}}', sanitizePromptFileForCommandTemplate(promptFile));
}
