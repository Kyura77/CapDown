import { readFile } from 'node:fs/promises';

export function buildStepKey(taskHeading, stepText) {
  return `${taskHeading || 'no-task'}::${stepText}`.toLowerCase();
}

export async function findNextUncheckedStep(planPath, options = {}) {
  const content = await readFile(planPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const skipStepKeys = new Set(options.skipStepKeys || []);

  let currentTaskHeading = null;
  let firstPendingStep = null;

  for (const line of lines) {
    if (line.startsWith('### ')) {
      currentTaskHeading = line.trim();
      continue;
    }

    if (line.trim().startsWith('- [ ]')) {
      const pendingStep = {
        taskHeading: currentTaskHeading,
        stepLine: line.trim(),
        stepText: line.trim().replace('- [ ]', '').trim(),
      };
      pendingStep.stepKey = buildStepKey(pendingStep.taskHeading, pendingStep.stepText);

      if (!firstPendingStep) {
        firstPendingStep = pendingStep;
      }

      if (!skipStepKeys.has(pendingStep.stepKey)) {
        return pendingStep;
      }
    }
  }

  if (firstPendingStep) {
    return firstPendingStep;
  }

  throw new Error('No unchecked Ralph loop step found in plan');
}
