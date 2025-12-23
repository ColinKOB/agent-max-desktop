# Agent Max Desktop - Beta Readiness

**Last Updated:** December 22, 2025
**Version:** 1.2.7
**Status:** Ready for Public Beta

---

## Quick Start

### Build & Distribute
```bash
npm run electron:build:mac    # macOS (DMG + ZIP)
npm run electron:build:win    # Windows (NSIS + Portable)
npm run electron:build:linux  # Linux (AppImage + DEB)
```

Output: `release/` directory

### GitHub Actions Build (Recommended)
Push to `main` branch triggers automated build with code signing and notarization.

---

## System Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Auto-Updater** | Ready | Beta mode: auto-download + auto-install |
| **Code Signing** | Ready | Apple Developer ID configured (Team: Q3Q2BF22GL) |
| **Notarization** | Ready | Automatic via electron-builder |
| **Billing System** | Ready | Stripe integration, token accrual billing |
| **Analytics** | Ready | PostHog integration |
| **Backend** | Ready | Railway deployment |
| **Database** | Ready | Supabase with RLS |
| **Terms of Service** | Ready | agentmax.app/privacy |

---

## Auto-Update Configuration

The updater (`electron/main/updater.cjs`) is configured for beta:

| Setting | Value |
|---------|-------|
| `BETA_AUTO_UPDATE` | `true` (auto-download + install) |
| `CHECK_INTERVAL_MS` | 15 minutes |
| `DEFAULT_CHANNEL` | `beta` |
| `AUTO_RESTART_DELAY_MS` | 3 seconds |

**For production release:** Set `BETA_AUTO_UPDATE: false` to require user consent.

---

## Security

| Feature | Status |
|---------|--------|
| Secret Management | Environment variables only |
| Code Obfuscation | Terser minification enabled |
| Apple Code Signing | Developer ID configured |
| macOS Entitlements | Hardened runtime, minimal permissions |
| Runtime Protection | Debug detection, anti-tampering |
| Update Security | Signed GitHub releases only |

**Security Score:** 8.4/10

---

## Environment Variables

### Required (Already Configured)
```bash
VITE_API_URL=https://agentmax-production.up.railway.app
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://rburoajxsyfousnleydw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_POSTHOG_KEY=phc_...
```

### GitHub Secrets (For CI/CD)
- `APPLE_ID` - Apple Developer email
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Q3Q2BF22GL
- `GH_TOKEN` - GitHub token for releases

---

## Build Configuration

### package.json (key settings)
```json
{
  "version": "1.2.7",
  "build": {
    "appId": "com.agentmax.desktop",
    "productName": "Agent Max",
    "mac": {
      "hardenedRuntime": true,
      "notarize": { "teamId": "Q3Q2BF22GL" }
    },
    "publish": {
      "provider": "github",
      "owner": "ColinKOB",
      "repo": "agent-max-desktop"
    }
  }
}
```

---

## Distribution Checklist

### Pre-Launch
- [x] Environment variables configured
- [x] Code signing certificates installed
- [x] Auto-updater tested
- [x] Backend deployed (Railway)
- [x] Database schema deployed (Supabase)
- [x] Stripe webhook configured
- [x] Terms of Service published
- [x] PostHog analytics enabled

### Launch Day
- [ ] Increment version in package.json
- [ ] Build via GitHub Actions (push to main)
- [ ] Verify notarization succeeded
- [ ] Create GitHub Release with release notes
- [ ] Test installation on clean machine
- [ ] Verify auto-update works from previous version

### Post-Launch
- [ ] Monitor PostHog for user activity
- [ ] Monitor Railway logs for errors
- [ ] Monitor Stripe for payments
- [ ] Collect beta feedback

---

## Beta Tester Instructions

### Installation
1. Download from GitHub Releases
2. macOS: Open DMG, drag to Applications
3. Windows: Run installer
4. Linux: Make AppImage executable, run

### First Launch
1. App generates device ID automatically
2. User can start using immediately (credits required for AI)
3. Auto-updates happen silently in background

### Feedback
- Report issues at: https://github.com/ColinKOB/agent-max-desktop/issues
- Email: support@agentmax.app

---

## Billing (For Beta Testers)

### Options to Give Free Credits

**Option A: Admin Credit Grant**
```sql
-- In Supabase SQL editor
UPDATE users SET credits = 500 WHERE email = 'tester@example.com';
```

**Option B: Stripe Coupon**
Create 100% off coupon in Stripe Dashboard, share code with testers.

**Option C: Feature Flag**
Set `BETA_UNLIMITED_CREDITS=true` in PostHog feature flag for beta tester cohort.

---

## File Sizes

| Platform | Size |
|----------|------|
| macOS DMG | ~120 MB |
| Windows NSIS | ~115 MB |
| Linux AppImage | ~118 MB |

---

## Troubleshooting

### "App is damaged" (macOS)
App wasn't notarized. Fix: `xattr -cr /Applications/Agent\ Max.app`

### "Windows protected your PC"
Click "More info" → "Run anyway" (or code sign with EV cert)

### Update not detected
- Check GitHub release has proper assets
- Verify version number incremented
- Check network connectivity

### Logs Location
- macOS: `~/Library/Logs/Agent Max/`
- Windows: `%APPDATA%/Agent Max/logs/`
- Linux: `~/.config/Agent Max/logs/`

---

## Related Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Billing & Pricing | `Agent_Max/docs/technical/BILLING_AND_PRICING.md` | Credit system, Stripe integration |
| Build Guide | `docs/guides/BUILD_GUIDE.md` | Detailed build instructions |
| Distribution Guide | `docs/guides/DISTRIBUTION_GUIDE.md` | Platform-specific distribution |

---

*Agent Max Desktop is ready for public beta distribution.*
