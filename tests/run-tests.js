import fs from 'fs';
import path from 'path';

// Run Jest with proper config resolution
const configPath = path.join(process.cwd(), 'jest.config.cjs');
const result = require('jest').runCLI(
  {
    config: configPath,
    passWithNoTests: true,
  },
  [process.cwd()]
);

process.exit(result.exitCode ?? 1);
