// Generate a minimal valid ICO file (16x16 blue circle favicon)
// Using a base64-encoded pre-made minimal ICO
const fs = require('fs');

// This is a minimal 16x16 ICO with a simple colored square
// Source: minimal valid ICO file structure
const icoBuffer = Buffer.from(
  '00000100010010100000010020006804000016000000280000001000000020000000010020000000000000040000130b0000130b00000000000000000000' +
  // Pixel data: 16x16 BGRA pixels, a simple gradient blue icon
  Array(16 * 16).fill(null).map((_, i) => {
    const x = i % 16;
    const y = Math.floor(i / 16);
    const dist = Math.sqrt((x-7.5)**2 + (y-7.5)**2);
    const inCircle = dist < 7.5;
    const B = inCircle ? 200 : 0;
    const G = inCircle ? 100 : 0;
    const R = inCircle ? 50 : 0;
    const A = inCircle ? 255 : 0;
    return [B, G, R, A].map(v => v.toString(16).padStart(2,'0')).join('');
  }).join(''),
  'hex'
);

// Actually, let's write a proper minimal ICO using known-good hex
// This is a valid 16x16 1bpp ICO (white icon)
const minimalIco = Buffer.from([
  0x00, 0x00,             // Reserved
  0x01, 0x00,             // Type: 1 = ICO
  0x01, 0x00,             // Count: 1 image
  // ICONDIRENTRY
  0x10,                   // Width: 16
  0x10,                   // Height: 16
  0x00,                   // ColorCount: 0 (true color)
  0x00,                   // Reserved
  0x01, 0x00,             // Planes: 1
  0x20, 0x00,             // BitCount: 32
  0x68, 0x04, 0x00, 0x00, // SizeInBytes: 1128
  0x16, 0x00, 0x00, 0x00, // ImageOffset: 22
]);

// Write the basic ICO header, then BITMAPINFOHEADER + pixel data
const bmpInfoHeader = Buffer.alloc(40);
bmpInfoHeader.writeInt32LE(40, 0);    // biSize
bmpInfoHeader.writeInt32LE(16, 4);   // biWidth
bmpInfoHeader.writeInt32LE(32, 8);   // biHeight (double for ICO)
bmpInfoHeader.writeInt16LE(1, 12);   // biPlanes
bmpInfoHeader.writeInt16LE(32, 14);  // biBitCount
bmpInfoHeader.writeInt32LE(0, 16);   // biCompression
bmpInfoHeader.writeInt32LE(16*16*4, 20); // biSizeImage
bmpInfoHeader.writeInt32LE(0, 24);
bmpInfoHeader.writeInt32LE(0, 28);
bmpInfoHeader.writeInt32LE(0, 32);
bmpInfoHeader.writeInt32LE(0, 36);

// Pixel data: 16x16 BGRA - draw a simple "A" icon (green circle)
const pixels = Buffer.alloc(16 * 16 * 4, 0);
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    const dist = Math.sqrt((x - 7.5) ** 2 + (y - 7.5) ** 2);
    const offset = ((15 - y) * 16 + x) * 4; // ICO is bottom-up
    if (dist < 7.5) {
      // Green circle (primary app color)
      pixels[offset + 0] = 80;   // B
      pixels[offset + 1] = 180;  // G
      pixels[offset + 2] = 80;   // R
      pixels[offset + 3] = 255;  // A
    }
  }
}

// AND mask (16x16 bits, 4 bytes per row)
const andMask = Buffer.alloc(16 * 4, 0);

// Fix the size in header
const totalImageSize = bmpInfoHeader.length + pixels.length + andMask.length;
minimalIco.writeUInt32LE(totalImageSize, 14);

const finalIco = Buffer.concat([minimalIco, bmpInfoHeader, pixels, andMask]);
fs.writeFileSync('public/favicon.ico', finalIco);
console.log('favicon.ico created, size:', finalIco.length);
