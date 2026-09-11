import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const httpFunctions = ['analytics_collect', 'dashboard_api'];

for (const functionName of httpFunctions) {
  test(`${functionName} scf_bootstrap uses LF line endings for CloudBase HTTP runtime`, () => {
    const bootstrap = readFileSync(
      resolve(projectRoot, 'cloudbase/functions', functionName, 'scf_bootstrap'),
    );

    assert.equal(bootstrap.includes(Buffer.from('\r\n')), false);
    assert.equal(bootstrap.includes(Buffer.from('\r')), false);
    assert.match(bootstrap.toString('utf8'), /^#!\/bin\/bash\nnode index\.js\n?$/);
  });
}
