// scripts/postinstall.mjs
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Ensure .obsidian plugin manifest directory exists for development
const obsidianDir = join(root, '.obsidian');
if (!existsSync(obsidianDir)) {
  mkdirSync(obsidianDir, { recursive: true });
  console.log('Hermedian: Created .obsidian directory for development');
}

console.log('Hermedian: Post-install complete');