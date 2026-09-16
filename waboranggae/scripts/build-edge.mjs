import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edge = path.join(root,'deployment/edge');
const requireEdge = createRequire(path.join(edge,'package.json'));
const { build } = requireEdge('esbuild');
const schema = (await readFile(path.join(root,'prisma/schema.prisma'),'utf8'))
  .replace(/generator client \{[^}]+\}/, 'generator client {\n provider = "prisma-client-js"\n engineType = "client"\n output = "./generated"\n}');
await writeFile(path.join(edge,'schema.prisma'),schema);
const generated = spawnSync(process.execPath,[requireEdge.resolve('prisma/build/index.js'),'generate','--schema',path.join(edge,'schema.prisma')],
  {cwd:root,env:process.env,encoding:'utf8',windowsHide:true});
if(generated.status!==0){console.error(generated.stderr.replace(/postgres(?:ql)?:\/\/\S+/g,'[REDACTED]'));throw new Error('Edge Prisma generation failed');}
const output = path.join(root,'supabase/functions/waboranggae-api/app.mjs');
await mkdir(path.dirname(output),{recursive:true});
const result=await build({entryPoints:[path.join(root,'server/app.ts')],outfile:output,bundle:true,platform:'node',format:'esm',target:'es2022',minify:true,metafile:true,
  banner:{js:'import { createRequire as __edgeCreateRequire } from "node:module"; import { Buffer } from "node:buffer"; import process from "node:process"; import { setImmediate, clearImmediate, setTimeout, clearTimeout, setInterval, clearInterval } from "node:timers"; const require = __edgeCreateRequire(import.meta.url); const global = globalThis;'},
  nodePaths:[path.join(edge,'node_modules'),path.join(root,'node_modules')],
  plugins:[{name:'edge-compatibility',setup(builder){
    builder.onResolve({filter:/^#wasm-compiler-loader$/},()=>({path:'query-compiler',namespace:'wasm-inline'}));
    builder.onLoad({filter:/.*/,namespace:'wasm-inline'},async()=>{
      const bytes=await readFile(path.join(edge,'generated/query_compiler_bg.wasm'));
      return{loader:'js',contents:'const bytes = Uint8Array.from(atob('+JSON.stringify(bytes.toString('base64'))+'), c => c.charCodeAt(0)); export default WebAssembly.compile(bytes).then(module => ({ default: module }));'};
    });
    builder.onResolve({filter:/dotenv\/config$/},()=>({path:'dotenv-config',namespace:'empty'}));
    builder.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export {};',loader:'js'}));
    builder.onResolve({filter:/db\/client$|\.\/client$|^\.\.\/client$/},args=>{
      const resolved=path.resolve(args.resolveDir,args.path).replaceAll('\\','/');
      if(resolved===path.join(root,'server/src/db/client').replaceAll('\\','/'))return{path:path.join(edge,'client.ts')};
    });
    builder.onResolve({filter:/^bcrypt$/},()=>({path:requireEdge.resolve('bcryptjs')}));
    builder.onResolve({filter:/^@prisma\//},args=>({path:requireEdge.resolve(args.path)}));
  }}]});
const bytes=(await readFile(output)).length;
// A content-addressed import ensures runtime module caches cannot reuse an older app.mjs.
const revision=createHash('sha256').update(await readFile(output)).digest('hex').slice(0,16);
const bundleName=`app-${revision}.mjs`;
await copyFile(output,path.join(path.dirname(output),bundleName));
const entrypoint=path.join(path.dirname(output),'index.ts');
const entry=await readFile(entrypoint,'utf8');
if(!/import\('\.\/app(?:-[a-f0-9]+)?\.mjs'\)/.test(entry))throw new Error('EDGE_ENTRYPOINT_IMPORT_NOT_FOUND');
await writeFile(entrypoint,entry.replace(/import\('\.\/app(?:-[a-f0-9]+)?\.mjs'\)/,`import('./${bundleName}')`));
const buildOnlyAuditPackages=['@prisma/config','deepmerge-ts','effect','prisma/build'];
const auditedBuildPackagesInBundle=buildOnlyAuditPackages.filter(pkg=>Object.keys(result.metafile.inputs).some(input=>input.replaceAll('\\','/').includes('/node_modules/'+pkg+'/')));
await mkdir(path.join(root,'.runtime'),{recursive:true});
await writeFile(path.join(root,'.runtime/edge-bundle-report.json'),JSON.stringify({createdAt:new Date().toISOString(),revision,bundleName,bytes,auditedBuildPackagesInBundle,inputs:Object.keys(result.metafile.inputs)},null,2));
console.log(JSON.stringify({edgeBundle:output,revision,bytes,localNodeDependenciesUnchanged:true,auditedBuildPackagesInBundle}));
