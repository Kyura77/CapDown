# Ralph Loop Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-native Ralph loop harness for CapDown that can discover the next pending plan step, build a fresh-context prompt, and run in `dry-run` or live mode through a configurable external agent command.

**Architecture:** Keep Ralph loop outside the product runtime. Implement a small Node.js orchestration layer under `tools/ralph-loop`, store prompts/state/logs under `tools/ralph-loop`, and expose root npm scripts. Use a command template from config/env so the harness is not tied to a single AI CLI.

**Tech Stack:** Node.js built-in modules, `node:test`, Markdown plan parsing, PowerShell wrapper, root `package.json`

**Repository note:** This workspace currently has no `.git` metadata. Replace commit steps with local checkpoints (list changed files + test output) unless git is initialized before implementation.

---

## File Map

### New files

- `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\README.md` - operator docs for the loop
- `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\config.example.json` - sample config
- `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\prompts\system.md` - fixed system prompt template
- `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\prompts\iteration.md` - per-iteration prompt template
- `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\state\.gitkeep` - state dir placeholder
- `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\logs\.gitkeep` - logs dir placeholder
- `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\lib\config.mjs` - config loading and validation
- `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\lib\plan-parser.mjs` - extracts next unchecked task
- `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\lib\agent-command.mjs` - builds external agent command
- `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\lib\state-store.mjs` - read/write current iteration state
- `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\run.mjs` - CLI entrypoint
- `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop.ps1` - Windows wrapper
- `C:\Users\cd250\Downloads\Projetos\CapDown\tests\ralph-loop\config.test.mjs` - config tests
- `C:\Users\cd250\Downloads\Projetos\CapDown\tests\ralph-loop\plan-parser.test.mjs` - parser tests
- `C:\Users\cd250\Downloads\Projetos\CapDown\tests\ralph-loop\agent-command.test.mjs` - command builder tests
- `C:\Users\cd250\Downloads\Projetos\CapDown\tests\ralph-loop\fixtures\sample-plan.md` - parser fixture

### Modified files

- `C:\Users\cd250\Downloads\Projetos\CapDown\package.json` - add root scripts for Ralph loop

---

### Task 1: Create the Ralph loop folder contract

**Files:**
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\README.md`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\config.example.json`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\prompts\system.md`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\prompts\iteration.md`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\state\.gitkeep`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\logs\.gitkeep`

- [ ] **Step 1: Create the example config file**

```json
{
  "projectRoot": ".",
  "specPath": "docs/superpowers/specs/2026-04-25-ralph-loop-design.md",
  "planPath": "docs/superpowers/plans/2026-04-25-ralph-loop-harness.md",
  "statePath": "tools/ralph-loop/state/current-run.json",
  "logsDir": "tools/ralph-loop/logs",
  "systemPromptPath": "tools/ralph-loop/prompts/system.md",
  "iterationPromptPath": "tools/ralph-loop/prompts/iteration.md",
  "agentCommandTemplate": "",
  "maxIterations": 10,
  "dryRun": true
}
```

- [ ] **Step 2: Create the system prompt template**

```md
You are running inside the CapDown Ralph loop.

Rules:
- Treat repository files as the source of truth.
- Read the spec and plan every iteration.
- Work only on the current unchecked step selected by the runner.
- Leave clear notes in files/logs instead of relying on chat history.
- Do not jump to unrelated refactors.
```

- [ ] **Step 3: Create the iteration prompt template**

```md
# Ralph Loop Iteration

## Current step
{{CURRENT_STEP}}

## Task heading
{{TASK_HEADING}}

## Spec path
{{SPEC_PATH}}

## Plan path
{{PLAN_PATH}}

## Previous iteration summary
{{PREVIOUS_SUMMARY}}
```

- [ ] **Step 4: Create the operator README**

```md
# CapDown Ralph Loop

This folder stores all persistent data for the Ralph loop harness:

- `config.example.json`: sample config
- `prompts/`: prompt templates
- `state/`: current loop state
- `logs/`: iteration logs

Usage flow:
1. Copy `config.example.json` to a local config file.
2. Set `CAPDOWN_RALPH_AGENT_CMD` or edit the local config.
3. Run `npm run ralph:dry-run`.
4. Inspect the generated state and logs.
```

- [ ] **Step 5: Create the directories and placeholders**

Run:

```powershell
New-Item -ItemType Directory -Force automation\ralph-loop\prompts,automation\ralph-loop\state,automation\ralph-loop\logs
New-Item -ItemType File -Force automation\ralph-loop\state\.gitkeep,automation\ralph-loop\logs\.gitkeep
```

Expected: directories exist without errors.

- [ ] **Step 6: Record checkpoint**

Record changed files and verify they exist:

```powershell
Get-ChildItem automation\ralph-loop -Recurse | Select-Object FullName
```

Expected: all six files/directories appear.

---

### Task 2: Implement config loading with tests first

**Files:**
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\tests\ralph-loop\config.test.mjs`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\lib\config.mjs`

- [ ] **Step 1: Write the failing config test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadConfig } from '../../tools/ralph-loop/lib/config.mjs';

test('loadConfig merges file config with environment command override', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ralph-config-'));
  const configPath = path.join(dir, 'config.json');

  await writeFile(configPath, JSON.stringify({
    projectRoot: '.',
    specPath: 'spec.md',
    planPath: 'plan.md',
    statePath: 'state.json',
    logsDir: 'logs',
    systemPromptPath: 'system.md',
    iterationPromptPath: 'iteration.md',
    agentCommandTemplate: 'from-file',
    maxIterations: 3,
    dryRun: true
  }, null, 2));

  process.env.CAPDOWN_RALPH_AGENT_CMD = 'from-env';

  const config = await loadConfig(configPath);

  assert.equal(config.agentCommandTemplate, 'from-env');
  assert.equal(config.maxIterations, 3);
  assert.equal(config.dryRun, true);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```powershell
node --test tests\ralph-loop\config.test.mjs
```

Expected: FAIL because `loadConfig` does not exist yet.

- [ ] **Step 3: Write the minimal config loader**

```js
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
  'dryRun'
];

export async function loadConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  const raw = await readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);

  const merged = {
    ...parsed,
    agentCommandTemplate: process.env.CAPDOWN_RALPH_AGENT_CMD || parsed.agentCommandTemplate || ''
  };

  for (const key of REQUIRED_KEYS) {
    if (!(key in merged)) {
      throw new Error(`Missing Ralph loop config key: ${key}`);
    }
  }

  return merged;
}
```

- [ ] **Step 4: Run the test and verify pass**

Run:

```powershell
node --test tests\ralph-loop\config.test.mjs
```

Expected: PASS

- [ ] **Step 5: Record checkpoint**

Run:

```powershell
Get-Content scripts\ralph-loop\lib\config.mjs
```

Expected: file contains `loadConfig`.

---

### Task 3: Implement plan parsing with tests first

**Files:**
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\tests\ralph-loop\fixtures\sample-plan.md`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\tests\ralph-loop\plan-parser.test.mjs`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\lib\plan-parser.mjs`

- [ ] **Step 1: Create the fixture plan**

```md
### Task 1: First task

- [x] Done step
- [ ] Pending first step

### Task 2: Second task

- [ ] Pending second task
```

- [ ] **Step 2: Write the failing parser test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { findNextUncheckedStep } from '../../tools/ralph-loop/lib/plan-parser.mjs';

test('findNextUncheckedStep returns the first pending checkbox and its task heading', async () => {
  const planPath = path.resolve('tests/ralph-loop/fixtures/sample-plan.md');
  const result = await findNextUncheckedStep(planPath);

  assert.equal(result.taskHeading, '### Task 1: First task');
  assert.equal(result.stepLine, '- [ ] Pending first step');
  assert.equal(result.stepText, 'Pending first step');
});
```

- [ ] **Step 3: Run the parser test and verify failure**

Run:

```powershell
node --test tests\ralph-loop\plan-parser.test.mjs
```

Expected: FAIL because parser file does not exist yet.

- [ ] **Step 4: Write the minimal parser**

```js
import { readFile } from 'node:fs/promises';

export async function findNextUncheckedStep(planPath) {
  const content = await readFile(planPath, 'utf8');
  const lines = content.split(/\r?\n/);

  let currentTaskHeading = null;

  for (const line of lines) {
    if (line.startsWith('### ')) {
      currentTaskHeading = line.trim();
      continue;
    }

    if (line.trim().startsWith('- [ ]')) {
      return {
        taskHeading: currentTaskHeading,
        stepLine: line.trim(),
        stepText: line.trim().replace('- [ ]', '').trim()
      };
    }
  }

  throw new Error('No unchecked Ralph loop step found in plan');
}
```

- [ ] **Step 5: Run the parser test and verify pass**

Run:

```powershell
node --test tests\ralph-loop\plan-parser.test.mjs
```

Expected: PASS

- [ ] **Step 6: Record checkpoint**

Run:

```powershell
node --test tests\ralph-loop\config.test.mjs tests\ralph-loop\plan-parser.test.mjs
```

Expected: both tests PASS.

---

### Task 4: Build the agent command and loop state with tests first

**Files:**
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\tests\ralph-loop\agent-command.test.mjs`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\lib\agent-command.mjs`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\lib\state-store.mjs`

- [ ] **Step 1: Write the failing command builder test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentCommand } from '../../tools/ralph-loop/lib/agent-command.mjs';

test('buildAgentCommand injects the prompt path into the configured template', () => {
  const built = buildAgentCommand('codex exec --prompt-file "{{PROMPT_FILE}}"', {
    promptFile: 'tools/ralph-loop/state/iteration-prompt.md'
  });

  assert.equal(
    built,
    'codex exec --prompt-file "tools/ralph-loop/state/iteration-prompt.md"'
  );
});
```

- [ ] **Step 2: Run the command builder test and verify failure**

Run:

```powershell
node --test tests\ralph-loop\agent-command.test.mjs
```

Expected: FAIL because `buildAgentCommand` does not exist yet.

- [ ] **Step 3: Write the command builder**

```js
export function buildAgentCommand(template, { promptFile }) {
  if (!template || !template.trim()) {
    throw new Error('Missing CAPDOWN_RALPH_AGENT_CMD or config agentCommandTemplate');
  }

  return template.replace('{{PROMPT_FILE}}', promptFile);
}
```

- [ ] **Step 4: Write the state and logging helpers**

```js
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeLoopState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

export async function readLoopState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    return null;
  }
}

export async function appendLoopLog(logsDir, filename, content) {
  await mkdir(logsDir, { recursive: true });
  await appendFile(path.join(logsDir, filename), `${content}\n`);
}
```

- [ ] **Step 5: Re-run the command builder test and verify pass**

Run:

```powershell
node --test tests\ralph-loop\agent-command.test.mjs
```

Expected: PASS

- [ ] **Step 6: Record checkpoint**

Run:

```powershell
node --test tests\ralph-loop\config.test.mjs tests\ralph-loop\plan-parser.test.mjs tests\ralph-loop\agent-command.test.mjs
```

Expected: all three tests PASS.

---

### Task 5: Implement the runner entrypoint and root scripts

**Files:**
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop\run.mjs`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\scripts\ralph-loop.ps1`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\package.json`

- [ ] **Step 1: Write the runner entrypoint**

```js
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

import { loadConfig } from './lib/config.mjs';
import { findNextUncheckedStep } from './lib/plan-parser.mjs';
import { buildAgentCommand } from './lib/agent-command.mjs';
import { appendLoopLog, readLoopState, writeLoopState } from './lib/state-store.mjs';

const exec = promisify(execCallback);

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const configPath = argValue('--config', 'tools/ralph-loop/config.example.json');
  const dryRunFlag = process.argv.includes('--dry-run');
  const config = await loadConfig(configPath);
  const nextStep = await findNextUncheckedStep(config.planPath);
  const previousState = await readLoopState(config.statePath);

  const prompt = [
    `Task heading: ${nextStep.taskHeading}`,
    `Current step: ${nextStep.stepText}`,
    `Spec: ${config.specPath}`,
    `Plan: ${config.planPath}`,
    `Previous summary: ${previousState?.lastSummary || 'none'}`
  ].join('\n');

  const promptFile = path.resolve('tools/ralph-loop/state/iteration-prompt.md');
  await writeFile(promptFile, prompt);

  const command = buildAgentCommand(config.agentCommandTemplate, { promptFile });
  const iteration = (previousState?.iteration || 0) + 1;
  const logFile = `iteration-${iteration}.log`;

  await writeLoopState(config.statePath, {
    iteration,
    currentTaskHeading: nextStep.taskHeading,
    currentStep: nextStep.stepText,
    command,
    lastSummary: dryRunFlag || config.dryRun ? 'dry-run only' : 'executed'
  });

  await appendLoopLog(config.logsDir, logFile, `iteration=${iteration}`);
  await appendLoopLog(config.logsDir, logFile, `task=${nextStep.taskHeading}`);
  await appendLoopLog(config.logsDir, logFile, `step=${nextStep.stepText}`);
  await appendLoopLog(config.logsDir, logFile, `command=${command}`);

  if (dryRunFlag || config.dryRun) {
    console.log(JSON.stringify({ mode: 'dry-run', iteration, command, nextStep }, null, 2));
    return;
  }

  const { stdout, stderr } = await exec(command, { cwd: config.projectRoot });
  if (stdout) await appendLoopLog(config.logsDir, logFile, stdout);
  if (stderr) await appendLoopLog(config.logsDir, logFile, stderr);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Fix the helper import if needed**

Ensure `appendLoopLog` is exported from `state-store.mjs` by using this exact file content:

```js
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeLoopState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

export async function readLoopState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    return null;
  }
}

export async function appendLoopLog(logsDir, filename, content) {
  await mkdir(logsDir, { recursive: true });
  await appendFile(path.join(logsDir, filename), `${content}\n`);
}
```

- [ ] **Step 3: Add root npm scripts**

Update `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "concurrently -n \"API,CLIENT\" -c \"bgBlue.bold,bgMagenta.bold\" \"npm run dev:v2:api\" \"npm --workspace @capdown/client run dev\"",
    "install-all": "npm install && cd frontend && npm install",
    "ralph:dry-run": "node tools/ralph-loop/bin/run.mjs --dry-run",
    "ralph:run": "node tools/ralph-loop/bin/run.mjs",
    "ralph:test": "node --test tests/ralph-loop/config.test.mjs tests/ralph-loop/plan-parser.test.mjs tests/ralph-loop/agent-command.test.mjs"
  }
}
```

- [ ] **Step 4: Add the PowerShell wrapper**

```powershell
param(
  [switch]$DryRun = $false,
[string]$Config = "tools/ralph-loop/config.example.json"
)

$argsList = @("tools/ralph-loop/bin/run.mjs", "--config", $Config)

if ($DryRun) {
  $argsList += "--dry-run"
}

node @argsList
```

- [ ] **Step 5: Run the Ralph loop dry-run**

Run:

```powershell
npm run ralph:dry-run
```

Expected: JSON output with `mode: "dry-run"` and a selected unchecked step.

- [ ] **Step 6: Record checkpoint**

Run:

```powershell
Get-Content automation\ralph-loop\state\current-run.json
Get-ChildItem automation\ralph-loop\logs
```

Expected: state file exists and at least one log file exists.

---

### Task 6: Finalize docs and manual operator flow

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\automation\ralph-loop\README.md`

- [ ] **Step 1: Expand the operator README with the manual flow**

Append this section:

````md
## Manual flow

### Dry-run

```powershell
npm run ralph:dry-run
```

### Live run

Set the agent command first:

```powershell
$env:CAPDOWN_RALPH_AGENT_CMD='codex exec --prompt-file "{{PROMPT_FILE}}"'
```

Then run:

```powershell
npm run ralph:run
```

### Expected outputs

- `tools/ralph-loop/state/current-run.json`
- `tools/ralph-loop/logs/iteration-N.log`
- `tools/ralph-loop/state/iteration-prompt.md`
````

- [ ] **Step 2: Run the full Ralph loop test suite**

Run:

```powershell
npm run ralph:test
```

Expected: PASS

- [ ] **Step 3: Run dry-run again as final validation**

Run:

```powershell
npm run ralph:dry-run
```

Expected: dry-run succeeds and writes fresh state/logs.

- [ ] **Step 4: Record final checkpoint**

Capture:

```powershell
Get-Content automation\ralph-loop\README.md
Get-Content automation\ralph-loop\state\current-run.json
```

Expected: docs and state match the Ralph loop contract.

---

## Final Validation Checklist

- [ ] Ralph loop files exist under `tools/ralph-loop`
- [ ] Node runner exists under `tools/ralph-loop/bin`
- [ ] `package.json` has Ralph loop scripts
- [ ] config loading is tested
- [ ] plan parsing is tested
- [ ] command building is tested
- [ ] `dry-run` works without calling a real AI agent
- [ ] state and logs are persisted in files
