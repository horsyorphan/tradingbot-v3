# Doggy&Tutu Trade Icons

This directory contains the logo and icon files for the Doggy&Tutu Trade application.

## Files

- **icon.svg** - Main application icon (256x256) with full logo design
- **favicon.svg** - Simplified favicon (32x32) for browser tabs
- **manifest.json** - Web app manifest referencing the icons

## Icon Design

The icon features:

- **Shield shape** - Represents security and trust
- **Checkmark** - Indicates successful trades and verification
- **Blue gradient** - Professional crypto trading theme
- **Bitcoin symbol** - Crypto currency reference

## For Electron App Icons

To add proper Electron app icons, you'll need to create PNG versions:

### Required sizes:

- 16x16 (icon-16.png)
- 32x32 (icon-32.png)
- 64x64 (icon-64.png)
- 128x128 (icon-128.png)
- 256x256 (icon-256.png)
- 512x512 (icon-512.png)

### For Windows:

- icon.ico (multiple sizes embedded)

### For macOS:

- icon.icns (multiple sizes embedded)

### Converting SVG to PNG:

You can use online converters or command line tools:

```bash
# Using ImageMagick
convert icon.svg -resize 256x256 icon-256.png

# Using Inkscape
inkscape icon.svg -w 256 -h 256 -o icon-256.png
```

## Usage in Electron

Update your `package.json` or Electron builder config:

```json
{
  "build": {
    "appId": "com.doggytutu.trade",
    "productName": "Doggy&Tutu Trade",
    "directories": {
      "output": "dist"
    },
    "files": ["src/**/*"],
    "mac": {
      "icon": "src/renderer/icons/icon.icns"
    },
    "win": {
      "icon": "src/renderer/icons/icon.ico"
    },
    "linux": {
      "icon": "src/renderer/icons/icon.png"
    }
  }
}
```
