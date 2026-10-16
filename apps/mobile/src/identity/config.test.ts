import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getApiBaseUrl,
  getClerkPublishableKey,
  isClerkConfigured,
} from './config.ts';

test('missing publishable key is fail-closed (not configured)', () => {
  const previous = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  assert.equal(getClerkPublishableKey(), null);
  assert.equal(isClerkConfigured(), false);
  if (previous === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = previous;
});

test('blank publishable key is fail-closed', () => {
  const previous = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = '   ';
  assert.equal(getClerkPublishableKey(), null);
  assert.equal(isClerkConfigured(), false);
  if (previous === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = previous;
});

test('non-empty publishable key is configured', () => {
  const previous = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';
  assert.equal(getClerkPublishableKey(), 'pk_test_example');
  assert.equal(isClerkConfigured(), true);
  if (previous === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = previous;
});

test('API base URL trims trailing slashes', () => {
  const previous = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001/';
  assert.equal(getApiBaseUrl(), 'http://127.0.0.1:3001');
  if (previous === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = previous;
});
