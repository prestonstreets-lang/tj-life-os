import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDayLabel, parseLocalDate, toLocalDateKey } from '../js/date.js';

test(`date-only values stay on the requested local day in ${process.env.TZ}`, () => {
  const parsed = parseLocalDate('2026-07-04');
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 6);
  assert.equal(parsed.getDate(), 4);
  assert.equal(toLocalDateKey(parsed), '2026-07-04');
  assert.equal(formatDayLabel('2026-07-04', 'en-US'), 'Sat, Jul 4');
});
