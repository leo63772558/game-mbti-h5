import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeAttribute, escapeHtml } from '../src/html.mjs';

test('escapeHtml escapes text inserted into element content', () => {
  assert.equal(
    escapeHtml('<img src=x onerror=alert(1)> "quote" & text'),
    '&lt;img src=x onerror=alert(1)&gt; &quot;quote&quot; &amp; text',
  );
});

test('escapeAttribute escapes quotes and angle brackets inserted into attributes', () => {
  assert.equal(
    escapeAttribute('" onmouseover="alert(1)" data-x=\'<tag>\''),
    '&quot; onmouseover=&quot;alert(1)&quot; data-x=&#39;&lt;tag&gt;&#39;',
  );
});

test('escape helpers preserve ordinary Chinese copy', () => {
  assert.equal(escapeHtml('异界职业档案'), '异界职业档案');
  assert.equal(escapeAttribute('狂战士 头像'), '狂战士 头像');
});
