const { execFileSync } = require('child_process');
const { notarize } = require('@electron/notarize');

module.exports = async function notarizeAndStaple(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.SKIP_NOTARIZE === '1') {
    console.log('[notarize] SKIP_NOTARIZE=1, skipping notarization.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  const hasCiCredentials = Boolean(
    process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
  );
  const options = hasCiCredentials
    ? {
        appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      }
    : {
        appPath,
        keychainProfile: process.env.APPLE_NOTARY_PROFILE || 'theo-notarize',
      };

  console.log(`[notarize] Submitting ${appPath}`);
  await notarize(options);
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' });
  execFileSync('xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' });
};
