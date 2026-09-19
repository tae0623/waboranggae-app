import {afterEach,describe,it,expect,vi} from 'vitest';
import {SignupBotError,signupBotConfig,verifySignupBot} from '../server/src/auth/signup-bot';
import {signupBotPage} from '../deployment/pages/signup-bot-page';
const setup=()=>{vi.stubEnv('SIGNUP_BOT_REQUIRED','true');vi.stubEnv('TURNSTILE_SITE_KEY','fixture-site-key');vi.stubEnv('TURNSTILE_SECRET_KEY','fixture-secret-not-real-123456');};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('server-side signup bot validation',()=>{
 it('leaves existing non-enforced development behavior unchanged',async()=>{vi.stubEnv('SIGNUP_BOT_REQUIRED','false');expect(signupBotConfig().required).toBe(false);await verifySignupBot(undefined);});
 it('fails closed for required but missing credentials',async()=>{setup();vi.stubEnv('TURNSTILE_SECRET_KEY','');await expect(verifySignupBot('x')).rejects.toMatchObject({status:503});});
 it.each([undefined,'','x'.repeat(2049),{}])('rejects invalid input before contacting Cloudflare',async token=>{setup();const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(verifySignupBot(token)).rejects.toMatchObject({status:400});expect(fetch).not.toHaveBeenCalled();});
 it.each([{success:false},{success:true,hostname:'attacker.example',action:'signup'},{success:true,hostname:'waboranggae-app.pages.dev',action:'login'}])('rejects unsuccessful or wrong-context verification',async data=>{setup();vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(data))));await expect(verifySignupBot('fixture-token')).rejects.toMatchObject({status:400});});
 it('accepts only verified signup tokens and sends no account data to Cloudflare',async()=>{
  setup();const fetch=vi.fn(async()=>new Response(JSON.stringify({success:true,hostname:'waboranggae-app.pages.dev',action:'signup'})));vi.stubGlobal('fetch',fetch);
  await verifySignupBot('fixture-token');const [url,options]=fetch.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
  expect(Object.keys(JSON.parse(options.body as string)).sort()).toEqual(['response','secret']);
 });
 it('does not permit signup if the verification service is offline',async()=>{setup();vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('offline')}));await expect(verifySignupBot('fixture-token')).rejects.toBeInstanceOf(SignupBotError);});
 it('widget contains no server credential and blocks attacker-selected parent origins',async()=>{
  const response=signupBotPage(new Request('https://waboranggae-app.pages.dev/auth/bot-check?parent=https://attacker.example'),'fixture-site-key');
  const body=await response.text();expect(response.status).toBe(200);expect(body).not.toContain('attacker.example');expect(body).toContain("action:'signup'");
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
 });
 it('missing or injected site keys cannot generate executable markup',async()=>{const r=signupBotPage(new Request('https://waboranggae-app.pages.dev/auth/bot-check'),'</script><script>alert(1)</script>');expect(r.status).toBe(503);expect(await r.text()).not.toContain('alert(1)');});
});
