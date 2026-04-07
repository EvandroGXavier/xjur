import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const releaseManifestPath = path.join(projectRoot, 'Version', 'release-manifest.json');
const deployStatePath = path.join(projectRoot, '.deploy-state.json');
const tempDeployStatePath = `${deployStatePath}.tmp`;

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const releaseManifest = fs.existsSync(releaseManifestPath)
  ? JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8'))
  : null;

const commitArgIndex = process.argv.indexOf('--commit');
const commit =
  commitArgIndex >= 0 && process.argv[commitArgIndex + 1]
    ? process.argv[commitArgIndex + 1]
    : process.env.DEPLOY_COMMIT || null;

const now = new Date().toISOString();
const deployState = {
  schemaVersion: 1,
  status: 'active',
  version: packageJson.version || '0.0.0',
  releaseCounter:
    typeof releaseManifest?.releaseCounter === 'number'
      ? releaseManifest.releaseCounter
      : null,
  commit,
  deployedAt: now,
  sourceUpdatedAt: releaseManifest?.updatedAt || null,
};

fs.writeFileSync(tempDeployStatePath, JSON.stringify(deployState, null, 2) + '\n');
fs.renameSync(tempDeployStatePath, deployStatePath);

console.log(
  `Deploy state atualizado: versao ${deployState.version} | contador ${deployState.releaseCounter ?? 'n/a'} | commit ${commit ?? 'n/a'}`,
);
