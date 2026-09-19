import { test } from 'vitest';
import assert from 'node:assert/strict';
import { edgeDeploymentOptions, verifyEdgeDeploymentMode } from '../scripts/lib/edge-deploy-policy.mjs';

test('public deploy and check require an explicit code-only action', () => {
  for (const action of ['--deploy-public', '--check-public']) {
    assert.throws(() => edgeDeploymentOptions([action]), /PUBLIC_DEPLOY_MUST_BE_CODE_ONLY/);
    assert.equal(edgeDeploymentOptions([action, '--code-only']).publicMode, true);
  }
  for (const args of [[], ['--code-only'], ['--deploy-public', '--deploy-validation', '--code-only'], ['--deploy-public', '--code-only', '--prune']]) {
    assert.throws(() => edgeDeploymentOptions(args), /EXPLICIT_DEPLOY_FLAG_REQUIRED/);
  }
});
test('validation deploy remains available with its original guards', () => {
  const options = edgeDeploymentOptions(['--deploy-validation']);
  const config = { NODE_ENV: 'production', API_RUNTIME: 'supabase-edge', EDGE_VALIDATION_MODE: 'true', EDGE_VALIDATION_KEY: 'x'.repeat(64) };
  assert.doesNotThrow(() => verifyEdgeDeploymentMode(config, options));
  assert.throws(() => verifyEdgeDeploymentMode({ ...config, EDGE_VALIDATION_MODE: 'false' }, options));
});
test('public deployment requires existing protection and cannot switch a private service', () => {
  const options = edgeDeploymentOptions(['--deploy-public', '--code-only']);
  const config = { NODE_ENV: 'production', API_RUNTIME: 'supabase-edge', EDGE_VALIDATION_MODE: 'false',
    SIGNUP_BOT_REQUIRED: 'true', QUOTA_STORE: 'database', EDGE_CLIENT_IP_HEADER: 'cf-connecting-ip' };
  assert.doesNotThrow(() => verifyEdgeDeploymentMode(config, options));
  for (const key of Object.keys(config)) assert.throws(() => verifyEdgeDeploymentMode({ ...config, [key]: '' }, options));
  assert.throws(() => verifyEdgeDeploymentMode({ ...config, EDGE_VALIDATION_MODE: 'true' }, options));
});
