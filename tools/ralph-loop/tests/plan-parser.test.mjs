import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { buildStepKey, findNextUncheckedStep } from '../lib/plan-parser.mjs';

test('findNextUncheckedStep returns the first pending checkbox and its task heading', async () => {
  const planPath = path.resolve('tools/ralph-loop/tests/fixtures/sample-plan.md');
  const result = await findNextUncheckedStep(planPath);

  assert.equal(result.taskHeading, '### Task 1: First task');
  assert.equal(result.stepLine, '- [ ] Pending first step');
  assert.equal(result.stepText, 'Pending first step');
  assert.equal(result.stepKey, buildStepKey('### Task 1: First task', 'Pending first step'));
});

test('findNextUncheckedStep skips previously attempted steps when alternatives exist', async () => {
  const planPath = path.resolve('tools/ralph-loop/tests/fixtures/sample-plan.md');
  const result = await findNextUncheckedStep(planPath, {
    skipStepKeys: [buildStepKey('### Task 1: First task', 'Pending first step')],
  });

  assert.equal(result.taskHeading, '### Task 1: First task');
  assert.equal(result.stepText, 'Pending second step');
});
