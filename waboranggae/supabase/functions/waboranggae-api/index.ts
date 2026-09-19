import process from 'node:process';
try {
  if(process.env.NODE_ENV!=='production'||process.env.API_RUNTIME!=='supabase-edge')throw new Error('EDGE_ENVIRONMENT_NOT_CONFIGURED');
  const { app } = await import('./app-ad9ba7061a3e0c18.mjs');
  app.listen(8000);
} catch(error) {
  // Details are available only to private validation tooling, never public probes.
  let detail=String(error instanceof Error ? error.stack : error);
  for(const value of Object.values(process.env).filter(value=>value && value.length>5))detail=detail.split(value!).join('[REDACTED]');
  detail=detail.split('\n').filter(line=>line.length<700).slice(0,8).join('\n');
  Deno.serve(request=>{
    const authorized=process.env.EDGE_VALIDATION_MODE==='true' && (process.env.EDGE_VALIDATION_KEY||'').length>=32
      && request.headers.get('X-Waboranggae-Validation')===process.env.EDGE_VALIDATION_KEY;
    return Response.json({ok:false,code:'STARTUP_FAILED',...(authorized?{detail}:{})},{status:503,headers:{'Cache-Control':'no-store'}});
  });
}
