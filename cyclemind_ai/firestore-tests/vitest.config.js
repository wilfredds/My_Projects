import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The emulator is a shared, stateful resource: parallel files would race on
    // clearFirestore(). One worker keeps the suite deterministic.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
