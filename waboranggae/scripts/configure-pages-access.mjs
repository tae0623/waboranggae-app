// Mutations are restricted to the explicitly approved Pages project/Production.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import { cloudflareClient, root } from './lib/cloudflare-pages-client.mjs';
async function main() {
  const action = process.argv[2];
  if (!['--apply-approved-access', '--retry-approved-deployment'].includes(action) || process.argv.length !== 3) throw Error('EXPLICIT_APPLY_FLAG_REQUIRED');
  const client = await cloudflareClient({ allowWrite: true }), target = client.target;
  const route = '/pages/projects/' + target.projectName;
  const before = await client.get(route), config = before.source?.config;
  if (before.subdomain !== new URL(target.origin).hostname || before.production_branch !== target.branch
      || config?.owner + '/' + config?.repo_name !== target.repository || config.preview_deployment_setting !== 'none'
      || before.deployment_configs?.production?.fail_open !== false || before.deployment_configs?.preview?.fail_open !== false) throw Error('PROJECT_SAFETY_SETTINGS_MISMATCH');
  const values = parse(await readFile(path.join(root, '.env.pages.local')));
  const keys = ['TEAM_WEB_ORIGIN','TEAM_WEB_PASSWORD','TEAM_WEB_SESSION_SECRET','TEAM_WEB_API_KEY','TEAM_WEB_API_EXPIRES_AT'];
  if (Object.keys(values).sort().join() !== [...keys].sort().join() || values.TEAM_WEB_ORIGIN !== target.origin
      || !/^[a-f0-9]{48}$/.test(values.TEAM_WEB_PASSWORD) || !/^[a-f0-9]{64}$/.test(values.TEAM_WEB_SESSION_SECRET)
      || !/^[a-f0-9]{64}$/.test(values.TEAM_WEB_API_KEY) || Date.parse(values.TEAM_WEB_API_EXPIRES_AT) <= Date.now()
      || Date.parse(values.TEAM_WEB_API_EXPIRES_AT) > Date.now() + 30 * 86400_000) throw Error('PAGES_LOCAL_CREDENTIALS_INVALID');
  const prod = before.deployment_configs.production, preview = before.deployment_configs.preview;
  if (Object.keys(preview.env_vars || {}).some(key => key.startsWith('TEAM_WEB_'))) throw Error('PREVIEW_MUST_NOT_HAVE_TEAM_CREDENTIALS');
  if (action === '--apply-approved-access') {
    const secrets = new Set(['TEAM_WEB_PASSWORD','TEAM_WEB_SESSION_SECRET','TEAM_WEB_API_KEY']);
    const vars = Object.fromEntries(keys.map(key => [key, { type: secrets.has(key) ? 'secret_text' : 'plain_text', value: values[key] }]));
    await client.patch({ deployment_configs: { production: { env_vars: vars, wrangler_config_hash: prod.wrangler_config_hash } } });
    const after = await client.get(route);
    if (JSON.stringify(after.deployment_configs.preview) !== JSON.stringify(preview)) throw Error('PREVIEW_SETTINGS_CHANGED');
    for (const [key, value] of Object.entries(prod.env_vars || {})) {
      if (!keys.includes(key) && JSON.stringify(after.deployment_configs.production.env_vars[key]) !== JSON.stringify(value)) throw Error('EXISTING_VARIABLE_CHANGED');
    }
    for (const key of keys) if (after.deployment_configs.production.env_vars[key]?.type !== vars[key].type) throw Error('BINDING_TYPE_MISMATCH');
    console.log(JSON.stringify({ configured: true, origin: target.origin, productionOnly: true, previewUnchanged: true, secretValuesPrinted: false, redeployed: false }));
  } else {
    for (const key of keys) if (!prod.env_vars?.[key]) throw Error('PRODUCTION_BINDINGS_MISSING');
    const deployment = before.latest_deployment;
    if (deployment?.environment !== 'production' || deployment.deployment_trigger?.metadata?.commit_hash !== '0eeedff122d29451bae05422a11cd0bbcc12d026') throw Error('DEPLOYMENT_CHANGED_REVIEW_REQUIRED');
    const result = await client.retry(deployment.id);
    const report = { requestedAt: new Date().toISOString(), project: target.projectName, id: result.id, origin: target.origin,
      environment: result.environment, stage: result.latest_stage };
    await writeFile(path.join(root, '.runtime/pages-deployment.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
}
main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'PAGES_CONFIGURATION_FAILED'); process.exitCode = 1; });
