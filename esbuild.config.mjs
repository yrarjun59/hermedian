import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.argv[2] === 'production';

async function main() {
  // Build CSS first
  await buildCSS();

  // Build main.ts
  await build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'main.js',
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    external: ['obsidian', 'electron', '@codemirror/state', '@codemirror/view'],
    sourcemap: isProduction ? false : 'inline',
    sourcesContent: false,
    treeShaking: true,
    minify: isProduction,
    define: {
      'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
    },
    banner: {
      js: '/* Hermedian - Hermes Agent in Obsidian */',
    },
  });

  // Copy manifest.json
  copyFileSync('manifest.json', 'manifest.json');

  // Copy styles.css if exists
  if (existsSync('styles.css')) {
    copyFileSync('styles.css', 'styles.css');
  }

  console.log(`${isProduction ? 'Production' : 'Development'} build complete`);
}

async function buildCSS() {
  // Simple CSS concatenation - in production you'd use lightningcss or similar
  const cssFiles = [
    'src/style/variables.css',
    'src/style/reset.css',
    'src/style/layout.css',
    'src/style/components.css',
    'src/style/chat.css',
    'src/style/inline-edit.css',
    'src/style/settings.css',
    'src/style/collab.css',
  ];

  let css = '';
  for (const file of cssFiles) {
    if (existsSync(file)) {
      css += readFileSync(file, 'utf8') + '\n';
    }
  }

  if (css) {
    writeFileSync('styles.css', css);
  }
}

main().catch(() => process.exit(1));