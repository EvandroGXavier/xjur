import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const releaseManifestPath = path.resolve(
  __dirname,
  '../Version/release-manifest.json',
);

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version || '1.0.0';
const parts = currentVersion.split('.');

let lastPart = parseInt(parts[parts.length - 1], 10);
if (Number.isNaN(lastPart)) {
  lastPart = 0;
}
lastPart += 1;

parts[parts.length - 1] = lastPart.toString();

const newVersion = parts.join('.');
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

let releaseManifest = {
  schemaVersion: 1,
  version: currentVersion,
  releaseCounter: 0,
  updatedAt: new Date().toISOString(),
  source: 'package.json',
};

if (fs.existsSync(releaseManifestPath)) {
  releaseManifest = {
    ...releaseManifest,
    ...JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8')),
  };
}

releaseManifest.version = newVersion;
releaseManifest.releaseCounter = Number(releaseManifest.releaseCounter || 0) + 1;
releaseManifest.updatedAt = new Date().toISOString();

fs.writeFileSync(
  releaseManifestPath,
  JSON.stringify(releaseManifest, null, 2) + '\n',
);

console.log(
  `Versao atualizada: ${currentVersion} -> ${newVersion} | contador ${releaseManifest.releaseCounter}`,
);
