'use strict';

// Loaded only into the isolated GATE-06 API process by the E2E harness.
const fixed = Number(process.env.E2E_GATE06_CLOCK_MS);
if (!Number.isSafeInteger(fixed) || fixed <= 0) throw new Error('invalid GATE-06 fixture clock');
Date.now = () => fixed;
