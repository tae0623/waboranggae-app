import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'dotenv';
// Local preparation only. Upload requires the user's project-specific secret-transfer approval.
if(!process.argv.includes('--prepare-social'))throw Error('EXPLICIT_PREPARE_FLAG_REQUIRED');
const edge=parse(await readFile('.env.edge.local')),local=parse(await readFile('.env'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
if(edge.PUBLIC_APP_URL!==base||edge.EDGE_VALIDATION_MODE!=='true')throw Error('VALIDATION_TARGET_MISMATCH');
for(const key of ['KAKAO_REST_API_KEY','KAKAO_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET']){
  if(!local[key]?.trim())throw Error('MISSING_'+key);
  edge[key]=local[key].trim();
}
edge.KAKAO_LOGIN_ENABLED='true';edge.GOOGLE_LOGIN_ENABLED='true';
await writeFile('.env.edge.local',Object.entries(edge).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
console.log(JSON.stringify({prepared:true,uploaded:false,secretValuesPrinted:false,callbackUris:['kakao','google'].map(p=>base+'/auth/social/'+p+'/callback')}));
