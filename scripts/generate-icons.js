const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconSizes = [
  { size: 16, name: 'icon-16.png' },
  { size: 32, name: 'icon-32.png' },
  { size: 48, name: 'icon-48.png' },
  { size: 64, name: 'icon-64.png' },
  { size: 128, name: 'icon-128.png' },
  { size: 256, name: 'icon-256.png' },
  { size: 512, name: 'icon-512.png' }
];

async function generateIcons() {
  const iconsDir = path.join(__dirname, '../src/renderer/icons');
  const logoPath = path.join(iconsDir, 'logo.png');

  console.log('📋 Icon Generation Script for Doggy&Tutu Trade');
  console.log('===============================================');

  if (!fs.existsSync(logoPath)) {
    console.error('❌ logo.png not found in icons directory');
    process.exit(1);
  }

  console.log('✅ Found logo.png');
  console.log('🔄 Generating different sized icons...');
  console.log('');

  try {
    // Generate each icon size
    for (const { size, name } of iconSizes) {
      const outputPath = path.join(iconsDir, name);
      
      await sharp(logoPath)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    console.log('');
    console.log('🎉 All icon sizes generated successfully!');
    console.log('');
    console.log('📁 Generated files:');
    iconSizes.forEach(({ name }) => {
      console.log(`   src/renderer/icons/${name}`);
    });
    
    console.log('');
    console.log('💡 For production builds, you may also want to create:');
    console.log('   - icon.ico (Windows) - use online converter like https://icoconvert.com/');
    console.log('   - icon.icns (macOS) - use online converter like https://iconverticons.com/');
    console.log('');
    console.log('🚀 Your Electron app now has proper desktop icons!');

  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons(); 