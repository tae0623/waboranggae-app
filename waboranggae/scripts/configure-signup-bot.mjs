// Only the two authorized Turnstile keys are read from the earlier settings file.
// Gmail settings are deliberately neither used nor uploaded.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {parse} from 'dotenv';
import {cloudflareClient,root} from './lib/cloudflare-pages-client.mjs';
const project='drtxexwznmpmiclvrjji';
async function main(){
 const action=process.argv[2];
 if(!['--check','--apply'].includes(action)||process.argv.length!==3)throw Error('EXPLICIT_ACTION_REQUIRED');
 const input=parse(await readFile(path.join(root,'.env.account-email.local')));
 const site=input.TURNSTILE_SITE_KEY||'',secret=input.TURNSTILE_SECRET_KEY||'';
 if(!/^[A-Za-z0-9_-]{10,100}$/.test(site)||!/^[A-Za-z0-9_-]{20,200}$/.test(secret)||site===secret||/^[123]x0/.test(site))throw Error('TURNSTILE_PRODUCTION_KEYS_REQUIRED');
 const client=await cloudflareClient({allowWrite:action==='--apply'});
 const route='/pages/projects/'+client.target.projectName;
 const before=await client.get(route),config=before.source?.config;
 if(before.subdomain!==new URL(client.target.origin).hostname||before.production_branch!=='ver5'
   ||config?.owner+'/'+config?.repo_name!==client.target.repository||config.preview_deployment_setting!=='none'
   ||before.deployment_configs?.production?.fail_open!==false||before.deployment_configs?.preview?.fail_open!==false)throw Error('PAGES_SAFETY_SETTINGS_MISMATCH');
 const edgePath=path.join(root,'.env.edge.local'),edgeText=await readFile(edgePath,'utf8'),edge=parse(edgeText);
 if(edge.PUBLIC_APP_URL!=='https://'+project+'.supabase.co/functions/v1/waboranggae-api'||edge.EDGE_VALIDATION_MODE!=='true')throw Error('EDGE_TARGET_MISMATCH');
 if(action==='--check'){console.log(JSON.stringify({keysPresent:true,ownPagesProjectConfirmed:true,ownSupabaseProjectConfirmed:true,changed:false,gmailUsed:false}));return;}
 const approved={SIGNUP_BOT_REQUIRED:'true',TURNSTILE_SITE_KEY:site,TURNSTILE_SECRET_KEY:secret};
 const envPath=path.join(root,'.env.signup-bot.local');
 await writeFile(envPath,Object.entries(approved).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
 const result=spawnSync(path.join(root,'.tools/edge/supabase.exe'),['secrets','set','--env-file',envPath,'--project-ref',project],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
 if(result.status!==0)throw Error('TURNSTILE_SECRET_UPLOAD_FAILED'); // Never echo CLI output.
 let next=edgeText;
 for(const[k,v]of Object.entries(approved)){
  const re=new RegExp('^'+k+'=.*$','m');
  next=re.test(next)?next.replace(re,k+'='+v):next.trimEnd()+'\n'+k+'='+v+'\n';
 }
 await writeFile(edgePath,next,{mode:0o600});
 await client.patch({deployment_configs:{production:{env_vars:{TURNSTILE_SITE_KEY:{type:'plain_text',value:site}},wrangler_config_hash:before.deployment_configs.production.wrangler_config_hash}}});
 const after=await client.get(route);
 if(JSON.stringify(after.deployment_configs.preview)!==JSON.stringify(before.deployment_configs.preview))throw Error('PREVIEW_SETTINGS_CHANGED');
 for(const[k,v]of Object.entries(before.deployment_configs.production.env_vars||{})){
  if(k!=='TURNSTILE_SITE_KEY'&&JSON.stringify(after.deployment_configs.production.env_vars[k])!==JSON.stringify(v))throw Error('EXISTING_VARIABLE_CHANGED');
 }
 if(after.deployment_configs.production.env_vars.TURNSTILE_SITE_KEY?.value!==site)throw Error('SITE_KEY_BINDING_FAILED');
 console.log(JSON.stringify({configured:true,supabaseProject:project,pagesOrigin:client.target.origin,secretOnSupabaseOnly:true,privateAccessUnchanged:true,gmailUsed:false,redeployed:false}));
}
main().catch(e=>{console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'SIGNUP_BOT_CONFIGURATION_FAILED');process.exitCode=1;});
