import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildAgentCommand } from '../lib/agent-command.mjs';
import { listAgentPresets, resolveAgentExecution } from '../lib/agent-presets.mjs';
import { appendLoopLog } from '../lib/logging.mjs';
import { readLoopState, writeLoopState } from '../lib/state-store.mjs';

test('buildAgentCommand injects the prompt path into the configured template', () => {
  const built = buildAgentCommand('codex exec --prompt-file "{{PROMPT_FILE}}"', {
    promptFile: 'tools/ralph-loop/state/iteration-prompt.md'
  });

  assert.equal(
    built,
    'codex exec --prompt-file "tools/ralph-loop/state/iteration-prompt.md"'
  );
});

test('buildAgentCommand fails when the template does not include the prompt placeholder', () => {
  assert.throws(
    () =>
      buildAgentCommand('codex exec --prompt-file iteration-prompt.md', {
        promptFile: 'tools/ralph-loop/state/iteration-prompt.md'
      }),
    /Missing \{\{PROMPT_FILE\}\} placeholder/
  );
});

test('buildAgentCommand fails when promptFile is missing', () => {
  assert.throws(
    () => buildAgentCommand('codex exec --prompt-file "{{PROMPT_FILE}}"', {}),
    /Missing promptFile/
  );
});

test('buildAgentCommand escapes percent signs for Windows command-template injection', () => {
  const built = buildAgentCommand('codex exec --prompt-file "{{PROMPT_FILE}}"', {
    promptFile: 'tools/%TEMP%/iteration prompt.md'
  });

  assert.equal(
    built,
    'codex exec --prompt-file "tools/%%TEMP%%/iteration prompt.md"'
  );
});

test('readLoopState returns null when the state file does not exist', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ralph-state-missing-'));
  const statePath = path.join(dir, 'current-run.json');

  const state = await readLoopState(statePath);

  assert.equal(state, null);
});

test('writeLoopState persists JSON and readLoopState loads it back', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ralph-state-roundtrip-'));
  const statePath = path.join(dir, 'nested', 'current-run.json');
  const expected = {
    iteration: 2,
    currentTaskHeading: '### Task 4: Build the agent command and loop state with tests first',
    currentStep: 'Write the command builder'
  };

  await writeLoopState(statePath, expected);

  const state = await readLoopState(statePath);

  assert.deepEqual(state, expected);
});

test('readLoopState throws when the state file contains invalid JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ralph-state-invalid-'));
  const statePath = path.join(dir, 'current-run.json');

  await writeLoopState(statePath, { ok: true });
  await writeFile(statePath, '{ invalid json');

  await assert.rejects(() => readLoopState(statePath), SyntaxError);
});

test('appendLoopLog creates the logs directory and appends newline-delimited entries', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ralph-log-'));
  const logsDir = path.join(dir, 'logs');
  const logName = 'iteration-1.log';

  await appendLoopLog(logsDir, logName, 'iteration=1');
  await appendLoopLog(logsDir, logName, 'step=Pending first step');

  const content = await readFile(path.join(logsDir, logName), 'utf8');

  assert.equal(content, 'iteration=1\nstep=Pending first step\n');
});

test('listAgentPresets returns the supported built-in presets', () => {
  assert.deepEqual(listAgentPresets(), ['codex', 'gemini']);
});

test('resolveAgentExecution returns the codex preset as a shell command', async () => {
  const execution = await resolveAgentExecution(
    { agentPreset: 'codex', agentCommandTemplate: '' },
    { promptFile: 'tools/ralph-loop/state/iteration-prompt.md' },
  );

  assert.equal(execution.command, 'codex exec --prompt-file "tools/ralph-loop/state/iteration-prompt.md"');
  assert.equal(execution.shell, true);
});

test('resolveAgentExecution returns the gemini preset with prompt contents in argv', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ralph-gemini-prompt-'));
  const promptFile = path.join(dir, 'iteration-prompt.md');
  await writeFile(promptFile, 'Current Ralph step');

  const execution = await resolveAgentExecution(
    { agentPreset: 'gemini', agentCommandTemplate: '' },
    { promptFile },
  );

  assert.equal(execution.command, 'gemini');
  assert.deepEqual(execution.args, ['-p', 'Current Ralph step', '--yolo', '--skip-trust']);
  assert.equal(execution.shell, false);
  assert.match(execution.displayCommand, /gemini -p <contents of .*iteration-prompt\.md> --yolo --skip-trust/);
});
