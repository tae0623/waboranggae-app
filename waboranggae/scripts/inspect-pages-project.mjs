// Read-only account/project check. Secret values are never returned or persisted.
import { cloudflareClient } from './lib/cloudflare-pages-client.mjs';
async function main() {
  const client = await cloudflareClient(), target = client.target;
  const project = await client.get('/pages/projects/' + target.projectName);
  if (project.name !== target.projectName || project.subdomain !== new URL(target.origin).hostname) throw Error('CLOUDFLARE_PROJECT_MISMATCH');
  const config = project.source?.config || {};
  const production = project.deployment_configs?.production || {}, preview = project.deployment_configs?.preview || {};
  const describe = value => ({ failOpen: value.fail_open ?? null, compatibilityDate: value.compatibility_date,
    variables: Object.entries(value.env_vars || {}).map(([name, item]) => ({ name, type: item.type, present: Boolean(item.value) })) });
  let plans;
  try { plans = (await client.get('/subscriptions')).map(plan => ({ id: plan.rate_plan?.id, name: plan.rate_plan?.public_name, state: plan.state, price: plan.price })); }
  catch (error) { plans = { notVerified: error.message }; }
  console.log(JSON.stringify({ readOnly: true, accountId: target.accountId, project: project.name, origin: target.origin,
    repository: config.owner + '/' + config.repo_name, productionBranch: project.production_branch,
    productionDeploymentsEnabled: config.production_deployments_enabled,
    previewDeploymentSetting: config.preview_deployment_setting,
    build: { root: project.build_config?.root_dir, command: project.build_config?.build_command, output: project.build_config?.destination_dir },
    production: describe(production), preview: describe(preview), subscriptions: plans,
    latest: { id: project.latest_deployment?.id, environment: project.latest_deployment?.environment,
      url: project.latest_deployment?.url, stage: project.latest_deployment?.latest_stage,
      commit: project.latest_deployment?.deployment_trigger?.metadata?.commit_hash },
  }, null, 2));
}
main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'PAGES_INSPECTION_FAILED'); process.exitCode = 1; });
