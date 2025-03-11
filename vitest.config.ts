/**
 * vitest.config.ts
 *
 * Testing configuration for the client-twitch package using Vitest.
 * Tests will run in a Node.js environment with coverage reporting.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html']
    }
  }
});
