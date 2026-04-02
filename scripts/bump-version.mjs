import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const currentVersion = packageJson.version || '1.0.0';
const parts = currentVersion.split('.');

// Increment the last part
let lastPart = parseInt(parts[parts.length - 1], 10);
if (isNaN(lastPart)) {
  lastPart = 0;
}
lastPart += 1;

// If the user wants "0.001", maybe they want the last part to be padded with zeros?
// But since their version is currently 1.0.0.0.1, we'll just increment it.
parts[parts.length - 1] = lastPart.toString();

const newVersion = parts.join('.');
packageJson.version = newVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`🚀 Versão atualizada: ${currentVersion} -> ${newVersion}`);
