import process from 'node:process';
if(process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL?.includes('@127.0.0.1:55432/waboranggae_dev')) throw new Error('Local validation only');
process.env.API_RUNTIME='supabase-edge';
const {app}=await import('../../supabase/functions/waboranggae-api/app.mjs');
app.listen(8789,'127.0.0.1',()=>console.log('Edge validation API ready: 8789'));
