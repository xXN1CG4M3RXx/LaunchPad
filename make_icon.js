// Render app-icon.svg -> app-icon.png at 1024x1024 using sharp
import sharp from 'sharp';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, 'app-icon.svg');
const outPath = join(__dirname, 'app-icon.png');

const svgBuffer = readFileSync(svgPath);

sharp(svgBuffer, { density: 96 })
  .resize(1024, 1024)
  .png()
  .toFile(outPath)
  .then(() => console.log('Icon saved to', outPath))
  .catch(err => { console.error(err); process.exit(1); });

