import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outputDir = resolve(projectRoot, outIndex >= 0 ? args[outIndex + 1] : 'dist');
const runtimeEntries = ['index.html', 'src', 'assets', 'admin', 'edgeone.json'];
const protectedProjectEntries = new Set([
  'admin',
  'assets',
  'cloudbase',
  'docs',
  'index.html',
  'node_modules',
  'scripts',
  'specs',
  'src',
  'tests',
  'README.md',
  'DEPLOYMENT.md',
  'edgeone.json',
  'package.json',
  'vercel.json',
].map((entry) => entry.toLowerCase()));

function assertSafeOutputDir(targetDir) {
  if (!targetDir || targetDir === projectRoot || targetDir === parse(targetDir).root) {
    throw new Error(`Refusing to clear unsafe output directory: ${targetDir}`);
  }

  const relativeTarget = relative(projectRoot, targetDir);
  if (!relativeTarget || relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
    throw new Error(`Refusing to clear output directory outside project root: ${targetDir}`);
  }

  const [topLevelEntry] = relativeTarget.split(sep);
  if (protectedProjectEntries.has(topLevelEntry.toLowerCase())) {
    throw new Error(`Refusing to clear protected project path as output directory: ${targetDir}`);
  }
}

assertSafeOutputDir(outputDir);

function copyRecursive(source, target) {
  const stats = statSync(source);
  if (stats.isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source)) {
      copyRecursive(join(source, entry), join(target, entry));
    }
    return;
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

if (existsSync(outputDir)) {
  rmSync(outputDir, { recursive: true, force: true });
}

mkdirSync(outputDir, { recursive: true });

for (const entry of runtimeEntries) {
  const source = resolve(projectRoot, entry);
  const target = resolve(outputDir, entry);
  copyRecursive(source, target);
}

console.info(`Built ${basename(outputDir)} with ${runtimeEntries.join(', ')}`);
