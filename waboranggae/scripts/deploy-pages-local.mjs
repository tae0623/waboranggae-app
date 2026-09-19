// Deploy reviewed local assets to the existing production Pages project only.
// GitHub contents, preview settings and team access settings are not changed.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {cloudflareClient,root} from './lib/cloudflare-pages-client.mjs';
async function main(){
 if(process.argv.slice(2).join(' ')!=='--deploy-approved')throw Error('EXPLICIT_DEPLOY_FLAG_REQUIRED');
 const client=await cloudflareClient(),target=client.target,route='/pages/projects/'+target.projectName;
 const before=await client.get(route),source=before.source?.config;
 if(before.production_branch!==target.branch||source?.owner+'/'+source?.repo_name!==target.repository
   ||source.preview_deployment_setting!=='none'||before.deployment_configs?.production?.fail_open!==false)throw Error('PAGES_SAFETY_MISMATCH');
 const worker=await readFile(path.join(root,'web/dist/_worker.js'),'utf8');
 if(!worker.includes('TEAM_WEB_PASSWORD')||!worker.includes('/auth/bot-check')||!worker.includes('TURNSTILE_SITE_KEY'))throw Error('BUILD_CURRENT_PAGES_FIRST');
 if(!before.deployment_configs.production.env_vars?.TURNSTILE_SITE_KEY)throw Error('TURNSTILE_BINDING_MISSING');
 const local=path.join(root,'.tools/cloudflare');
 const env={...process.env,XDG_CONFIG_HOME:path.join(local,'config'),WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',CLOUDFLARE_AUTH_USE_KEYRING:'true'};
 for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CLOUDFLARE_ACCOUNT_ID','CF_API_TOKEN','CF_API_KEY','CF_EMAIL','CF_ACCOUNT_ID'])delete env[key];
 env.CLOUDFLARE_ACCOUNT_ID=target.accountId;
 const result=spawnSync(process.execPath,[path.join(local,'node_modules/wrangler/bin/wrangler.js'),'pages','deploy',path.join(root,'web/dist'),
  '--project-name',target.projectName,'--branch',target.branch,'--commit-dirty=true','--commit-message','feat: signup bot protection and test account login','--profile','ddubugi-pages'],
  {cwd:local,env,encoding:'utf8',windowsHide:true,timeout:180000});
 if(result.status!==0)throw Error('PAGES_LOCAL_DEPLOY_FAILED');
 const after=await client.get(route);
 if(after.latest_deployment?.environment!=='production')throw Error('PRODUCTION_DEPLOYMENT_NOT_CONFIRMED');
 const report={deployed:true,origin:target.origin,deploymentId:after.latest_deployment.id,stage:after.latest_deployment.latest_stage,
  workerSha256:createHash('sha256').update(worker).digest('hex'),gitHubChanged:false,checkedAt:new Date().toISOString()};
 await writeFile(path.join(root,'.runtime/signup-bot-pages-deployment.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'PAGES_DEPLOY_FAILED');process.exitCode=1;});
