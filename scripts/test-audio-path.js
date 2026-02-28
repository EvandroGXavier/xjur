const fs = require('fs');
const path = require('path');

const mediaUrl = 'storage/uploads/test.ogg';
const fullPath = path.join(process.cwd(), mediaUrl);

console.log('Testing path:', fullPath);
console.log('Exists?', fs.existsSync(fullPath));

if (fs.existsSync(fullPath)) {
  const fileBuffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  console.log('Ext:', ext);
}
