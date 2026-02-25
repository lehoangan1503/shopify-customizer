const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const FRAME_WIDTH = 1141;
const FRAME_HEIGHT = 3313;

async function createLeatherFrame(sourcePath, outputPath, brightness = 0.4) {
  const sourceImg = await loadImage(sourcePath);
  
  const canvas = createCanvas(FRAME_WIDTH, FRAME_HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // Fill with black first
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  
  // Tile the source texture
  const tileW = sourceImg.width;
  const tileH = sourceImg.height;
  
  for (let y = 0; y < FRAME_HEIGHT; y += tileH) {
    for (let x = 0; x < FRAME_WIDTH; x += tileW) {
      ctx.drawImage(sourceImg, x, y, tileW, tileH);
    }
  }
  
  // Darken the image to remove baked-in lighting (lower brightness = darker)
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgb(${Math.floor(brightness * 255)}, ${Math.floor(brightness * 255)}, ${Math.floor(brightness * 255)})`;
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  
  // Save as JPEG
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath} (${FRAME_WIDTH}x${FRAME_HEIGHT})`);
}

async function main() {
  // Use PNG converted files
  const croc = './public/croc-temp.png';
  const black = './public/black-temp.png';
  
  // Create darker versions - brightness 0.25-0.3 for rich black leather
  await createLeatherFrame(croc, './public/leather-frame.jpg', 0.28);
  await createLeatherFrame(black, './public/leather-frame1.jpg', 0.3);
  
  console.log('Done!');
}

main().catch(console.error);
