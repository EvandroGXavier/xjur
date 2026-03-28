
try {
  require('tesseract.js');
  console.log('✅ tesseract.js loaded');
  require('pdf-img-convert');
  console.log('✅ pdf-img-convert loaded');
  process.exit(0);
} catch (e) {
  console.error('❌ Error loading dependencies:', e.message);
  process.exit(1);
}
