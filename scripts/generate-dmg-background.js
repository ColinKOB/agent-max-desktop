/**
 * Generate DMG Background Image
 * Creates a sophisticated installation background following the "Velocity Gradient" design philosophy
 *
 * Standard DMG size: 540x380 (1x), 1080x760 (2x retina)
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Register fonts
const fontsDir = path.join(__dirname, '../node_modules/@anthropic-agent-skills/canvas-fonts') ||
                 '/Users/colinobrien/.claude/plugins/marketplaces/anthropic-agent-skills/skills/canvas-design/canvas-fonts';

// Try to register fonts if available
try {
  registerFont(path.join(fontsDir, 'InstrumentSans-Regular.ttf'), { family: 'Instrument Sans' });
  registerFont(path.join(fontsDir, 'InstrumentSans-Bold.ttf'), { family: 'Instrument Sans', weight: 'bold' });
} catch (e) {
  console.log('Using system fonts');
}

async function generateBackground(scale = 1) {
  const width = 540 * scale;
  const height = 380 * scale;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // === BACKGROUND: Deep space gradient ===
  const bgGradient = ctx.createRadialGradient(
    width * 0.5, height * 0.4, 0,
    width * 0.5, height * 0.4, width * 0.8
  );
  bgGradient.addColorStop(0, '#1a1a2e');    // Deep blue-black center
  bgGradient.addColorStop(0.5, '#16162a');   // Darker mid
  bgGradient.addColorStop(1, '#0f0f1a');     // Near black edge

  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // === SUBTLE GRID PATTERN (aerospace/precision feel) ===
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
  ctx.lineWidth = 1 * scale;

  const gridSize = 40 * scale;
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // === ACCENT GLOW: Warm amber energy ===
  // Position for where the app icon will be (left side)
  const glowX = width * 0.28;
  const glowY = height * 0.45;

  const glowGradient = ctx.createRadialGradient(
    glowX, glowY, 0,
    glowX, glowY, 120 * scale
  );
  glowGradient.addColorStop(0, 'rgba(234, 140, 50, 0.12)');  // Agent Max orange
  glowGradient.addColorStop(0.4, 'rgba(234, 140, 50, 0.05)');
  glowGradient.addColorStop(1, 'rgba(234, 140, 50, 0)');

  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, width, height);

  // === VELOCITY LINES: Directional momentum ===
  // Subtle lines suggesting motion from left to right
  ctx.strokeStyle = 'rgba(234, 140, 50, 0.08)';
  ctx.lineWidth = 1 * scale;

  // Draw flowing lines
  for (let i = 0; i < 5; i++) {
    const startY = height * (0.35 + i * 0.08);
    const controlY = startY + (Math.random() - 0.5) * 20 * scale;

    ctx.beginPath();
    ctx.moveTo(width * 0.1, startY);
    ctx.quadraticCurveTo(
      width * 0.5, controlY,
      width * 0.9, startY + (i - 2) * 15 * scale
    );
    ctx.stroke();
  }

  // === DIRECTIONAL ARROW: Installation guide ===
  // Elegant arrow pointing from app to Applications folder
  const arrowY = height * 0.5;
  const arrowStartX = width * 0.42;
  const arrowEndX = width * 0.58;

  // Arrow line
  const arrowGradient = ctx.createLinearGradient(arrowStartX, arrowY, arrowEndX, arrowY);
  arrowGradient.addColorStop(0, 'rgba(234, 140, 50, 0.4)');
  arrowGradient.addColorStop(1, 'rgba(234, 140, 50, 0.7)');

  ctx.strokeStyle = arrowGradient;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(arrowStartX, arrowY);
  ctx.lineTo(arrowEndX - 8 * scale, arrowY);
  ctx.stroke();

  // Arrow head
  ctx.fillStyle = 'rgba(234, 140, 50, 0.7)';
  ctx.beginPath();
  ctx.moveTo(arrowEndX, arrowY);
  ctx.lineTo(arrowEndX - 12 * scale, arrowY - 6 * scale);
  ctx.lineTo(arrowEndX - 12 * scale, arrowY + 6 * scale);
  ctx.closePath();
  ctx.fill();

  // === CHEVRON ACCENT (Agent Max brand element) ===
  // Subtle brand mark in corner
  ctx.strokeStyle = 'rgba(234, 140, 50, 0.15)';
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const chevronX = width * 0.92;
  const chevronY = height * 0.08;
  const chevronSize = 12 * scale;

  // Left chevron
  ctx.beginPath();
  ctx.moveTo(chevronX - chevronSize, chevronY - chevronSize);
  ctx.lineTo(chevronX - chevronSize - 4 * scale, chevronY + chevronSize);
  ctx.stroke();

  // Right chevron
  ctx.beginPath();
  ctx.moveTo(chevronX, chevronY - chevronSize);
  ctx.lineTo(chevronX - 4 * scale, chevronY + chevronSize);
  ctx.stroke();

  // === BOTTOM TEXT: Whispered guidance ===
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Drag to Applications to install', width * 0.5, height * 0.92);

  // === CORNER ACCENT: Version/quality mark ===
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.font = `${8 * scale}px -apple-system, BlinkMacSystemFont, monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('AGENT MAX', width * 0.04, height * 0.96);

  return canvas;
}

async function main() {
  const outputDir = path.join(__dirname, '../resources');

  // Generate 1x version
  console.log('Generating 1x DMG background...');
  const canvas1x = await generateBackground(1);
  const buffer1x = canvas1x.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'dmg-background.png'), buffer1x);
  console.log('Created: resources/dmg-background.png (540x380)');

  // Generate 2x retina version
  console.log('Generating 2x DMG background...');
  const canvas2x = await generateBackground(2);
  const buffer2x = canvas2x.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'dmg-background@2x.png'), buffer2x);
  console.log('Created: resources/dmg-background@2x.png (1080x760)');

  console.log('\nDMG backgrounds generated successfully!');
}

main().catch(console.error);
