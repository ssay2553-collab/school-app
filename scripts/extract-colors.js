const ColorThief = require('colorthief');
const path = require('path');

// Avoid using __dirname directly (ESLint/no-undef in some configs and ESM mode).
// Use process.cwd() so this script works when run from the project root.
const imgPath = path.join(process.cwd(), 'assets', 'images', 'afahjoy.png');

async function run() {
  try {
    // getPalette returns an array of RGB arrays
    const palette = await ColorThief.getPalette(imgPath, 6);
    const hexPalette = palette.map(rgb => {
      const hex = rgb.map(v => v.toString(16).padStart(2, '0')).join('');
      return `#${hex}`;
    });
    console.log('PALETTE_START');
    console.log(JSON.stringify(hexPalette, null, 2));
    console.log('PALETTE_END');
  } catch (err) {
    console.error('Error extracting colors:', err.message || err);
    process.exit(2);
  }
}

run();
