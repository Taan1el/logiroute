import { configureAxe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { expect } from 'vitest';
import type { AxeMatchers } from 'vitest-axe/matchers';

expect.extend(matchers);

// jsdom computes no colors or layout, so color-contrast and region are off here; contrast was verified separately from computed values.
export const axe = configureAxe({
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
});

declare module 'vitest' {
  // eslint-disable-next-line
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
