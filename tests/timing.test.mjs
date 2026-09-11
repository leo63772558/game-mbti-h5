import test from 'node:test';
import assert from 'node:assert/strict';

import { QUIZ_AUTO_ADVANCE_DELAY_MS } from '../src/timing.mjs';

test('quiz auto advance delay stays responsive after option selection', () => {
  assert.ok(QUIZ_AUTO_ADVANCE_DELAY_MS <= 220);
  assert.ok(QUIZ_AUTO_ADVANCE_DELAY_MS >= 120);
});
