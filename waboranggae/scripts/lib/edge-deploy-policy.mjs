// Deployment scope is explicit. Public updates must never replace server secrets.
export function edgeDeploymentOptions(args) {
  const actions = ['--deploy-validation', '--check-public', '--deploy-public'];
  if (args.some(value => ![...actions, '--code-only'].includes(value))
      || new Set(args).size !== args.length || args.filter(value => actions.includes(value)).length !== 1) {
    throw Error('EXPLICIT_DEPLOY_FLAG_REQUIRED');
  }
  const publicMode = args.includes('--deploy-public') || args.includes('--check-public');
  const codeOnly = args.includes('--code-only');
  if (publicMode && !codeOnly) throw Error('PUBLIC_DEPLOY_MUST_BE_CODE_ONLY');
  return { publicMode, codeOnly, checkOnly: args.includes('--check-public') };
}

export function verifyEdgeDeploymentMode(config, options) {
  if (config.NODE_ENV !== 'production' || config.API_RUNTIME !== 'supabase-edge') throw Error('EDGE_ENVIRONMENT_REQUIRED');
  if (options.publicMode) {
    if (config.EDGE_VALIDATION_MODE !== 'false') throw Error('PUBLIC_MODE_MUST_ALREADY_BE_ENABLED');
    if (config.SIGNUP_BOT_REQUIRED !== 'true' || config.QUOTA_STORE !== 'database'
        || config.EDGE_CLIENT_IP_HEADER !== 'cf-connecting-ip') throw Error('PUBLIC_PROTECTION_SETTINGS_REQUIRED');
  } else if (config.EDGE_VALIDATION_MODE !== 'true' || (config.EDGE_VALIDATION_KEY || '').length < 32) {
    throw Error('VALIDATION_GATE_REQUIRED');
  }
}
