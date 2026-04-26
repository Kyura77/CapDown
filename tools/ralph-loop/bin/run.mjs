import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { exec as execCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { loadConfig } from '../lib/config.mjs';
import { findNextUncheckedStep } from '../lib/plan-parser.mjs';
import { resolveAgentExecution } from '../lib/agent-presets.mjs';
import { appendLoopLog } from '../lib/logging.mjs';
import { readLoopState, writeLoopState } from '../lib/state-store.mjs';

const exec = promisify(execCallback);

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const configPath = argValue('--config', 'tools/ralph-loop/config.example.json');
  const dryRunFlag = process.argv.includes('--dry-run');
  const presetFlag = argValue('--agent', '');
  const config = await loadConfig(configPath);
  const previousState = await readLoopState(config.statePath);
  const nextStep = await findNextUncheckedStep(config.planPath, {
    skipStepKeys: previousState?.attemptedStepKeys || [],
  });
  const isDryRun = dryRunFlag || config.dryRun;
  const effectiveConfig = presetFlag ? { ...config, agentPreset: presetFlag } : config;

  const prompt = [
    `Task heading: ${nextStep.taskHeading}`,
    `Current step: ${nextStep.stepText}`,
    `Current step key: ${nextStep.stepKey}`,
    `Spec: ${config.specPath}`,
    `Plan: ${config.planPath}`,
    `Previous summary: ${previousState?.lastSummary || 'none'}`,
  ].join('\n');

  const promptFile = path.resolve('tools/ralph-loop/state/iteration-prompt.md');
  await mkdir(path.dirname(promptFile), { recursive: true });
  await writeFile(promptFile, prompt);

  const execution = await resolveAgentExecution(effectiveConfig, { promptFile });
  const iteration = (previousState?.iteration || 0) + 1;
  const logFile = `iteration-${iteration}.log`;
  const attemptedStepKeys = Array.isArray(previousState?.attemptedStepKeys)
    ? [...new Set([...previousState.attemptedStepKeys, nextStep.stepKey])]
    : [nextStep.stepKey];

  await writeLoopState(config.statePath, {
    iteration,
    currentTaskHeading: nextStep.taskHeading,
    currentStep: nextStep.stepText,
    currentStepKey: nextStep.stepKey,
    attemptedStepKeys,
    agentPreset: effectiveConfig.agentPreset || '',
    command: execution.displayCommand,
    promptFile,
    lastRunAt: new Date().toISOString(),
    lastSummary: isDryRun ? 'dry-run only' : 'executed',
  });

  await appendLoopLog(config.logsDir, logFile, `iteration=${iteration}`);
  await appendLoopLog(config.logsDir, logFile, `task=${nextStep.taskHeading}`);
  await appendLoopLog(config.logsDir, logFile, `step=${nextStep.stepText}`);
  await appendLoopLog(config.logsDir, logFile, `stepKey=${nextStep.stepKey}`);
  await appendLoopLog(config.logsDir, logFile, `agentPreset=${effectiveConfig.agentPreset || 'custom'}`);
  await appendLoopLog(config.logsDir, logFile, `command=${execution.displayCommand}`);

  if (isDryRun) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      iteration,
      agentPreset: effectiveConfig.agentPreset || '',
      command: execution.displayCommand,
      nextStep,
      attemptedStepKeys,
    }, null, 2));
    return;
  }

  if (!execution.command) {
    throw new Error('No Ralph loop agent command configured');
  }

  if (execution.shell === false) {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(execution.command, execution.args || [], {
        cwd: config.projectRoot,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Agent command exited with code ${code}`));
          return;
        }

        resolve({ stdout, stderr });
      });
    });

    if (result.stdout) {
      await appendLoopLog(config.logsDir, logFile, result.stdout);
    }
    if (result.stderr) {
      await appendLoopLog(config.logsDir, logFile, result.stderr);
    }
    return;
  }

  const { stdout, stderr } = await exec(execution.command, { cwd: config.projectRoot });
  if (stdout) {
    await appendLoopLog(config.logsDir, logFile, stdout);
  }
  if (stderr) {
    await appendLoopLog(config.logsDir, logFile, stderr);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
