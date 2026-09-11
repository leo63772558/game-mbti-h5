import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

function listRelativeFiles(root, base = root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(root, entry.name);
    const relative = fullPath.slice(base.length + 1).replaceAll('\\', '/');
    if (entry.isDirectory()) return listRelativeFiles(fullPath, base);
    return [relative];
  });
}

test('build script emits only static runtime assets into dist', () => {
  const outDir = resolve(projectRoot, '.tmp-build-test');

  try {
    execFileSync(process.execPath, ['scripts/build.mjs', '--out', outDir], {
      cwd: projectRoot,
      stdio: 'pipe',
    });

    const files = listRelativeFiles(outDir);
    const topLevel = readdirSync(outDir).sort();

    assert.deepEqual(topLevel, ['admin', 'assets', 'edgeone.json', 'index.html', 'src']);
    assert.ok(files.includes('index.html'));
    assert.ok(files.includes('edgeone.json'));
    assert.ok(files.includes('src/app.mjs'));
    assert.ok(files.includes('src/styles.css'));
    assert.ok(files.includes('admin/dashboard.html'));
    assert.ok(files.includes('admin/dashboard.mjs'));
    assert.ok(files.includes('admin/dashboard.css'));
    assert.ok(statSync(join(outDir, 'assets')).isDirectory());
    assert.ok(!files.some((file) => file.startsWith('docs/')));
    assert.ok(!files.some((file) => file.startsWith('tests/')));
    assert.ok(!files.includes('README.md'));
    assert.ok(!files.includes('DEPLOYMENT.md'));
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('EdgeOne config serves ES modules with a browser-executable MIME type', () => {
  const config = JSON.parse(readFileSync(resolve(projectRoot, 'edgeone.json'), 'utf8'));
  const moduleHeaderRules = config.headers.filter((rule) => rule.source.endsWith('.mjs'));

  assert.deepEqual(
    moduleHeaderRules.map((rule) => rule.source).sort(),
    ['/admin/*.mjs', '/src/*.mjs', '/src/data/*.mjs'],
  );

  for (const rule of moduleHeaderRules) {
    assert.deepEqual(rule.headers, [
      {
        key: 'Content-Type',
        value: 'application/javascript',
      },
    ]);
  }
});

test('entry HTML cache-busts long-lived runtime assets on static hosting', () => {
  const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
  const dashboardHtml = readFileSync(resolve(projectRoot, 'admin/dashboard.html'), 'utf8');

  assert.match(html, /href="\.\/src\/styles\.css\?v=[^"]+"/);
  assert.match(html, /src="\.\/src\/app\.mjs"/);
  assert.doesNotMatch(html, /src="\.\/src\/app\.mjs\?v=/);
  assert.match(dashboardHtml, /src="\.\/dashboard\.mjs"/);
  assert.doesNotMatch(dashboardHtml, /src="\.\/dashboard\.mjs\?v=/);
});

test('build script rejects output directories outside the project root', () => {
  const unsafeOutDir = mkdtempSync(join(tmpdir(), 'unsafe-game-mbti-build-'));

  try {
    const result = spawnSync(process.execPath, ['scripts/build.mjs', '--out', unsafeOutDir], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /outside project root|unsafe output directory/i);
  } finally {
    rmSync(unsafeOutDir, { recursive: true, force: true });
  }
});

test('build script rejects project source directories as output targets', () => {
  const result = spawnSync(process.execPath, ['scripts/build.mjs', '--out', 'src'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe output directory|protected project path/i);
});
