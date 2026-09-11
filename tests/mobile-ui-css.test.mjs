import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const styles = readFileSync(resolve(projectRoot, 'src/styles.css'), 'utf8');

function assertRule(selector, declarations) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\}`);
  const match = styles.match(pattern);
  assert.ok(match?.groups?.body, `${selector} rule should exist`);

  for (const declaration of declarations) {
    assert.match(match.groups.body, declaration, `${selector} should include ${declaration}`);
  }
}

test('mobile quiz keeps navigation reachable on short screens', () => {
  assertRule('.quiz .nav-row', [
    /position:\s*sticky;/,
    /bottom:\s*max\(0px,\s*env\(safe-area-inset-bottom\)\);/,
    /z-index:\s*2;/,
  ]);
});

test('share preview scales with viewport height instead of using a fixed tall box', () => {
  assertRule('.share-preview', [
    /min-height:\s*min\(320px,\s*42dvh\);/,
  ]);
  assertRule('.share-preview-image', [
    /max-height:\s*min\(52dvh,\s*420px\);/,
  ]);
});

test('short mobile screens have a compact layout override', () => {
  assert.match(styles, /@media\s*\(max-width:\s*430px\)\s*and\s*\(max-height:\s*760px\)/);
  assert.match(styles, /\.terminal-panel\s*\{[\s\S]*?gap:\s*14px;[\s\S]*?padding:\s*14px;/);
  assert.match(styles, /\.quiz\s*\{[\s\S]*?gap:\s*12px;[\s\S]*?padding-top:\s*14px;/);
  assert.match(styles, /\.share-preview\s*\{[\s\S]*?min-height:\s*min\(240px,\s*36dvh\);/);
});

test('route-style result page centers the main identity for mobile sharing', () => {
  assertRule('.journey-route', [
    /grid-template-columns:\s*repeat\(4,\s*1fr\);/,
  ]);
  assertRule('.result-hero', [
    /text-align:\s*center;/,
  ]);
  assertRule('.result-hero h1', [
    /font-size:\s*clamp\(34px,\s*9vw,\s*42px\);/,
  ]);
  assertRule('.details-toggle', [
    /min-height:\s*48px;/,
  ]);
});

test('option C route visual uses gold route controls instead of terminal cyan', () => {
  assert.match(styles, /\.primary,\s*\n\.ghost\s*\{[\s\S]*?border-radius:\s*8px;[\s\S]*?background:\s*var\(--gold\);/);
  assertRule('.question-panel', [
    /background:\s*rgba\(255,\s*255,\s*255,\s*0\.065\);/,
    /border-radius:\s*8px;/,
  ]);
  assertRule('.result-mini-grid', [
    /grid-template-columns:\s*1fr\s*1fr;/,
  ]);
  assert.doesNotMatch(styles, /--cyan|7be0d6|123,\s*224,\s*214|9cebe3/);
});

test('question scene layout keeps long prompts readable on mobile', () => {
  assertRule('.question-panel-scene', [
    /gap:\s*11px;/,
    /padding:\s*12px;/,
  ]);
  assertRule('.question-illustration', [
    /height:\s*116px;/,
    /overflow:\s*hidden;/,
  ]);
  assertRule('.question-narrative', [
    /font-size:\s*14px;/,
    /line-height:\s*1\.5;/,
  ]);
  assertRule('.quiz-with-scene .nav-row', [
    /position:\s*relative;/,
    /background:\s*none;/,
  ]);
  assert.match(styles, /@media\s*\(max-width:\s*430px\)\s*and\s*\(max-height:\s*760px\)[\s\S]*?\.question-illustration\s*\{[\s\S]*?height:\s*92px;/);
});
