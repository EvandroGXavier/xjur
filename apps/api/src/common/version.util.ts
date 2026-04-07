import * as fs from 'fs';
import * as path from 'path';

type JsonMap = Record<string, any>;

function tryReadJson(filePath: string): JsonMap | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function fallbackReleaseCounter(version: string | null | undefined) {
  if (!version) return null;
  const parts = String(version).split('.');
  const last = Number(parts[parts.length - 1]);
  return Number.isFinite(last) ? last : null;
}

export function resolveProjectRoot() {
  let current = process.cwd();

  for (let index = 0; index < 8; index += 1) {
    if (
      fs.existsSync(path.join(current, 'Version')) &&
      fs.existsSync(path.join(current, 'package.json'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(__dirname, '../../../..');
}

export function readRuntimeVersionInfo() {
  const root = resolveProjectRoot();
  const packageJson =
    tryReadJson(path.join(root, 'package.json')) ||
    tryReadJson(path.join(root, 'apps/api/package.json')) ||
    {};
  const releaseManifest =
    tryReadJson(path.join(root, 'Version', 'release-manifest.json')) || {};
  const deployState = tryReadJson(path.join(root, '.deploy-state.json')) || {};

  const sourceVersion = packageJson.version || releaseManifest.version || '0.0.0';
  const sourceCounter =
    typeof releaseManifest.releaseCounter === 'number'
      ? releaseManifest.releaseCounter
      : fallbackReleaseCounter(sourceVersion);
  const deployedVersion = deployState.version || null;
  const deployedCounter =
    typeof deployState.releaseCounter === 'number'
      ? deployState.releaseCounter
      : fallbackReleaseCounter(deployedVersion);

  return {
    sourceVersion,
    sourceReleaseCounter: sourceCounter,
    sourceUpdatedAt: releaseManifest.updatedAt || null,
    deployedVersion,
    deployedReleaseCounter: deployedCounter,
    deployedAt: deployState.deployedAt || null,
    deployedCommit: deployState.commit || null,
    deployStatus: deployState.status || 'unknown',
    displayVersion: deployedVersion || sourceVersion,
    displayReleaseCounter:
      deployedCounter ?? sourceCounter ?? fallbackReleaseCounter(sourceVersion),
    isLatestDeployed:
      Boolean(deployedVersion) &&
      deployedVersion === sourceVersion &&
      (deployedCounter ?? null) === (sourceCounter ?? null),
  };
}
