import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { createHash } from 'node:crypto';
import { loadSupabaseSettings } from './check-supabase.mjs';
import { edgeDeploymentOptions, verifyEdgeDeploymentMode } from './lib/edge-deploy-policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function main(){
  const options=edgeDeploymentOptions(process.argv.slice(2));
  const functionDir=path.join(root,'supabase/functions/waboranggae-api');
  const entry=await readFile(path.join(functionDir,'index.ts'),'utf8');
  const bundle=entry.match(/import\('\.\/(app-([a-f0-9]{16})\.mjs)'\)/);
  if(!bundle || createHash('sha256').update(await readFile(path.join(functionDir,bundle[1]))).digest('hex').slice(0,16)!==bundle[2])throw Error('BUILD_CURRENT_EDGE_BUNDLE_FIRST');
  const config=parse(await readFile(path.join(root,'.env.edge.local')));
  if(Object.keys(config).some(name=>name.startsWith('TMAP_')))throw Error('RETIRED_PROVIDER_SECRET_FORBIDDEN');
  verifyEdgeDeploymentMode(config,options);
  const admin=await loadSupabaseSettings();
  const ref=decodeURIComponent(new URL(admin.connectionString).username).split('.').at(-1);
  if(!/^[a-z]{20}$/.test(ref)||config.PUBLIC_APP_URL!=='https://'+ref+'.supabase.co/functions/v1/waboranggae-api')throw Error('PROJECT_MISMATCH');
  if(decodeURIComponent(new URL(config.DATABASE_URL).username)!=='waboranggae_api.'+ref)throw Error('RUNTIME_ROLE_REQUIRED');
  const cli=path.join(root,'.tools/edge/supabase.exe');
  function run(args){
    const result=spawnSync(cli,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});
    if(result.status!==0){
      // CLI errors can echo secret values: redact every locally configured value.
      let message=result.stderr+'\n'+result.stdout;
      for(const value of Object.values(config).filter(x=>x.length>5))message=message.split(value).join('[REDACTED]');
      const lines=message.split(/\r?\n/).filter(x=>x.length<700).slice(-12);
      console.error(JSON.stringify({step:args.slice(0,2).join(' '),diagnostic:lines}));
      throw Error('SUPABASE_CLI_FAILED');
    }
    return result.stdout;
  }
  let previous;
  if(options.publicMode){
    const functions=JSON.parse(run(['functions','list','--project-ref',ref,'--output','json']));
    const current=functions.find(value=>value.slug==='waboranggae-api');
    if(!current||current.status!=='ACTIVE'||current.verify_jwt!==false)throw Error('EXISTING_PUBLIC_FUNCTION_REQUIRED');
    previous={version:current.version,status:current.status,verifyJwt:current.verify_jwt,updatedAt:current.updated_at};
    for(const [route,status] of [['/readyz',200],['/auth/signup-config',200],['/api/user/me',401]]){
      const response=await fetch(config.PUBLIC_APP_URL+route,{redirect:'error',signal:AbortSignal.timeout(30000)});
      if(response.status!==status)throw Error('PUBLIC_PREFLIGHT_FAILED');
      const data=await response.json();
      if(route==='/readyz'&&data.ok!==true)throw Error('PUBLIC_PREFLIGHT_FAILED');
      if(route==='/auth/signup-config'&&(data.required!==true||data.available!==true))throw Error('SIGNUP_PROTECTION_NOT_READY');
    }
    await mkdir(path.join(root,'.runtime'),{recursive:true});
    await writeFile(path.join(root,'.runtime/edge-public-preflight.json'),JSON.stringify({checkedAt:new Date().toISOString(),project:ref,previous,revision:bundle[2],codeOnly:true},null,2));
    if(options.checkOnly){console.log(JSON.stringify({preflightPassed:true,project:ref,previous,revision:bundle[2],changed:false}));return;}
  }
  if(!options.codeOnly){
    run(['secrets','set','--env-file','.env.edge.local','--project-ref',ref]);
    console.log('Server-only runtime secrets uploaded to the selected project.');
  }
  run(['functions','deploy','waboranggae-api','--project-ref',ref,'--use-api','--no-verify-jwt']);
  const report={deployed:true,deployedAt:new Date().toISOString(),revision:bundle[2],previous,validationOnly:!options.publicMode,apiBase:config.PUBLIC_APP_URL,secretsUploaded:!options.codeOnly,existingPcConfigurationUnchanged:true};
  await mkdir(path.join(root,'.runtime'),{recursive:true});
  await writeFile(path.join(root,'.runtime/edge-last-deploy.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(/^[A-Z0-9_]{3,80}$/.test(error?.message||'')?error.message:'EDGE_DEPLOY_FAILED');process.exitCode=1;});
