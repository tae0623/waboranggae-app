const { validateReleaseEnvironment } = require('./scripts/release-config.cjs');
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === 'production' || process.env.APP_RELEASE === 'true') {
    const problems = validateReleaseEnvironment(process.env);
    if (problems.length) throw new Error(problems.join('\n'));
  }
  return config;
};
