const { execFileSync } = require('child_process');

const dmgs = process.argv.slice(2);
if (dmgs.length === 0) throw new Error('Pass at least one DMG path.');

const hasCiCredentials = Boolean(
  process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
);

for (const dmg of dmgs) {
  const authArgs = hasCiCredentials
    ? [
        '--apple-id', process.env.APPLE_ID,
        '--password', process.env.APPLE_APP_SPECIFIC_PASSWORD,
        '--team-id', process.env.APPLE_TEAM_ID,
      ]
    : ['--keychain-profile', process.env.APPLE_NOTARY_PROFILE || 'theo-notarize'];

  console.log(`[notarize] Submitting DMG ${dmg}`);
  execFileSync('xcrun', ['notarytool', 'submit', dmg, ...authArgs, '--wait'], { stdio: 'inherit' });
  execFileSync('xcrun', ['stapler', 'staple', dmg], { stdio: 'inherit' });
  execFileSync('xcrun', ['stapler', 'validate', dmg], { stdio: 'inherit' });
}
