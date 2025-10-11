# 🎨 macOS Icon Fix

**Date:** October 11, 2025, 9:57 AM  
**Status:** ✅ **READY TO FIX**

---

## 🐛 Problem

**Dock shows wrong icon:**
- First launch: White rounded square with cropped logo corner
- Running app: Correct black/orange logo

**Root Cause:**
The `.icns` bundle icon is incorrectly exported:
- Missing icon sizes
- Off-center artwork
- Cropped or improperly scaled

macOS composites it into a white rounded square, showing only a corner of your logo.

---

## ✅ Solution

### 1. Generate Proper `.icns` File

**Requirements:**
- Source: 1024×1024 PNG
- Centered artwork
- Transparent background
- No pre-baked rounded corners
- All required sizes (16-1024px)

### 2. Run Icon Generation Script

```bash
npm run generate:icons
```

This will:
1. Create all required icon sizes (16px to 1024px)
2. Generate `build/icon.icns`
3. Include @2x retina versions

### 3. Rebuild App

```bash
npm run electron:build:mac
```

### 4. Clear Icon Cache

```bash
killall Dock
killall Finder
```

---

## 📝 What Was Created

### `generate-icons.sh`
Automated script that:
- Uses `sips` to resize source PNG
- Creates all required icon sizes
- Converts to `.icns` with `iconutil`

### Updated `package.json`
```json
{
  "scripts": {
    "generate:icons": "chmod +x generate-icons.sh && ./generate-icons.sh"
  },
  "build": {
    "mac": {
      "icon": "build/icon.icns"
    }
  }
}
```

---

## 🔧 Icon Sizes Generated

| Size | Usage | Retina |
|------|-------|--------|
| 16×16 | Menu bar | 32×32 @2x |
| 32×32 | Finder small | 64×64 @2x |
| 128×128 | Finder medium | 256×256 @2x |
| 256×256 | Finder large | 512×512 @2x |
| 512×512 | Dock | 1024×1024 @2x |

---

## 🎯 Source Requirements

### Your `AgentMaxLogo.png` Should Be:

**Dimensions:**
- 1024×1024 pixels minimum
- Square aspect ratio
- Power of 2 preferred

**Content:**
- Artwork centered
- No rounded corners (macOS adds them)
- Transparent background
- No padding/margins

**Format:**
- PNG with alpha channel
- High quality (not compressed)
- sRGB color space

---

## 🧪 Testing

### Before Building:
1. **Check source icon:**
   ```bash
   file public/AgentMaxLogo.png
   # Should show: PNG image data, 1024 x 1024
   ```

2. **Generate icons:**
   ```bash
   npm run generate:icons
   ```

3. **Verify .icns created:**
   ```bash
   ls -lh build/icon.icns
   # Should exist and be ~200-500KB
   ```

### After Building:
1. **Install app:**
   ```bash
   open release/Agent\ Max-1.0.0.dmg
   ```

2. **Check Dock icon:**
   - Should show full logo
   - Should be centered
   - Should have proper rounded corners

3. **Clear cache if needed:**
   ```bash
   killall Dock
   killall Finder
   ```

---

## 📊 Before vs After

### Before (Broken):
```
Dock Icon:
┌─────────────┐
│ ⬜⬜⬜⬜⬜  │  ← White rounded square
│ ⬜⬜⬜⬜⬜  │
│ ⬜⬜⬜⬜⬜  │
│ ⬜⬜⬜🟧🟧 │  ← Only corner visible
│ ⬜⬜⬜🟧🟧 │
└─────────────┘
```

### After (Fixed):
```
Dock Icon:
┌─────────────┐
│             │
│   🟧  🟧   │  ← Full logo centered
│   🟧  🟧   │
│   🟧  🟧   │
│             │
└─────────────┘
```

---

## 🚨 Common Issues

### Issue 1: Icon Still Wrong After Rebuild
**Solution:**
```bash
# Clear all icon caches
rm -rf ~/Library/Caches/com.apple.iconservices.store
killall Dock
killall Finder
```

### Issue 2: Script Permission Denied
**Solution:**
```bash
chmod +x generate-icons.sh
```

### Issue 3: `sips` or `iconutil` Not Found
**Solution:**
These are built into macOS. If missing, you're not on macOS or need to install Xcode Command Line Tools:
```bash
xcode-select --install
```

### Issue 4: Source PNG Too Small
**Solution:**
Ensure `public/AgentMaxLogo.png` is at least 1024×1024:
```bash
sips -g pixelWidth -g pixelHeight public/AgentMaxLogo.png
```

---

## 🎨 Icon Design Best Practices

### DO:
- ✅ Use 1024×1024 source
- ✅ Center artwork
- ✅ Transparent background
- ✅ Simple, recognizable design
- ✅ High contrast
- ✅ Test at small sizes (16×16)

### DON'T:
- ❌ Add rounded corners (macOS does this)
- ❌ Add shadows (macOS adds them)
- ❌ Use gradients that don't scale
- ❌ Include text smaller than 32px
- ❌ Use thin lines (<2px)

---

## 📚 Technical Details

### `.icns` Structure:
```
icon.icns
├── icon_16x16.png       (16×16)
├── icon_16x16@2x.png    (32×32)
├── icon_32x32.png       (32×32)
├── icon_32x32@2x.png    (64×64)
├── icon_128x128.png     (128×128)
├── icon_128x128@2x.png  (256×256)
├── icon_256x256.png     (256×256)
├── icon_256x256@2x.png  (512×512)
├── icon_512x512.png     (512×512)
└── icon_512x512@2x.png  (1024×1024)
```

### Why All Sizes Matter:
- **16×16:** Menu bar icons
- **32×32:** Finder list view
- **128×128:** Finder icon view
- **256×256:** Finder cover flow
- **512×512:** Dock, Quick Look
- **1024×1024:** Retina displays

---

## 🔄 Workflow

### Development:
```bash
# 1. Update source icon
# Edit: public/AgentMaxLogo.png

# 2. Generate .icns
npm run generate:icons

# 3. Test in dev mode
npm run electron:dev
```

### Production:
```bash
# 1. Generate icons
npm run generate:icons

# 2. Build app
npm run electron:build:mac

# 3. Clear cache
killall Dock; killall Finder

# 4. Test built app
open release/Agent\ Max-1.0.0.dmg
```

---

## 📝 Files Created/Modified

### New Files:
- ✅ `generate-icons.sh` - Icon generation script
- ✅ `ICON_FIX.md` - This documentation
- ✅ `build/icon.icns` - Generated icon bundle (after running script)

### Modified Files:
- ✅ `package.json` - Added icon path and script

---

## 🎯 Next Steps

1. **Run icon generation:**
   ```bash
   npm run generate:icons
   ```

2. **Verify output:**
   ```bash
   ls -lh build/icon.icns
   ```

3. **Rebuild app:**
   ```bash
   npm run electron:build:mac
   ```

4. **Clear cache:**
   ```bash
   killall Dock
   killall Finder
   ```

5. **Test:**
   - Install from DMG
   - Check Dock icon
   - Verify all sizes look good

---

## ✅ Success Criteria

- [ ] `build/icon.icns` exists (~200-500KB)
- [ ] Dock shows full logo (not cropped)
- [ ] Logo is centered
- [ ] Rounded corners applied correctly
- [ ] All sizes (16-1024) look sharp
- [ ] No white background bleeding

---

*Icon fix ready: October 11, 2025, 9:57 AM*  
*Run `npm run generate:icons` to fix!* 🎨
