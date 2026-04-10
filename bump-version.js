#!/usr/bin/env node
/**
 * bump-version.js — Xjur / Dr.X
 *
 * Uso:
 *   node bump-version.js                   → bump contador (mesma versão)
 *   node bump-version.js 1.0.002           → nova versão (contador reinicia em 1)
 *   node bump-version.js --patch           → incrementa patch: 1.0.001 → 1.0.002
 *   node bump-version.js --minor           → incrementa minor: 1.0.001 → 1.1.000
 *   node bump-version.js --major           → incrementa major: 1.0.001 → 2.0.000
 *
 * O que faz:
 *   1. Lê Version/release-manifest.json
 *   2. Determina a nova versão (argumento ou incremento automático)
 *   3. Se a versão mudou → reseta o releaseCounter para 1
 *   4. Se mesma versão   → incrementa releaseCounter
 *   5. Atualiza updatedAt com o timestamp atual
 *   6. Salva release-manifest.json
 *   7. Atualiza .deploy-state.json
 *   8. Imprime resumo no console
 */

const fs = require('fs');
const path = require('path');

// ─── Caminhos ──────────────────────────────────────────────────────────────
const ROOT = __dirname;
const MANIFEST_PATH = path.join(ROOT, 'Version', 'release-manifest.json');
const DEPLOY_STATE_PATH = path.join(ROOT, '.deploy-state.json');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');

// ─── Helpers ───────────────────────────────────────────────────────────────
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function parseVersion(v) {
  const parts = String(v || '0.0.0').split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  return parts;
}

function formatVersion(parts) {
  // Mantém o formato com zero-padding da parte patch: 1.0.001
  return `${parts[0]}.${parts[1]}.${String(parts[2]).padStart(3, '0')}`;
}

function incrementVersion(current, part) {
  const parts = parseVersion(current);
  if (part === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  else if (part === 'minor') { parts[1]++; parts[2] = 0; }
  else { parts[2]++; } // patch
  return formatVersion(parts);
}

function formatDateBR(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Leitura do estado atual ────────────────────────────────────────────────
const manifest = readJson(MANIFEST_PATH) || {
  schemaVersion: 1,
  version: '1.0.001',
  releaseCounter: 0,
  updatedAt: new Date().toISOString(),
  source: 'manual',
};
const deployState = readJson(DEPLOY_STATE_PATH) || {};
const packageJson = readJson(PACKAGE_JSON_PATH) || {};

const currentVersion = manifest.version || '1.0.001';
const currentCounter = Number(manifest.releaseCounter) || 0;

// ─── Determinar nova versão ─────────────────────────────────────────────────
const arg = process.argv[2];
let newVersion;

if (!arg) {
  // Sem argumento → apenas incrementa o contador na versão atual
  newVersion = currentVersion;
} else if (arg === '--patch') {
  newVersion = incrementVersion(currentVersion, 'patch');
} else if (arg === '--minor') {
  newVersion = incrementVersion(currentVersion, 'minor');
} else if (arg === '--major') {
  newVersion = incrementVersion(currentVersion, 'major');
} else if (/^\d+\.\d+(\.\d+)?$/.test(arg)) {
  // Versão explícita passada como argumento
  const parts = parseVersion(arg);
  newVersion = formatVersion(parts);
} else {
  console.error(`❌ Argumento inválido: "${arg}"`);
  console.error('   Use: node bump-version.js [versão | --patch | --minor | --major]');
  process.exit(1);
}

// ─── Calcular novo contador ─────────────────────────────────────────────────
const versionChanged = newVersion !== currentVersion;
const newCounter = versionChanged ? 1 : currentCounter + 1;
const now = new Date().toISOString();

// ─── Atualizar release-manifest.json ───────────────────────────────────────
const newManifest = {
  schemaVersion: 1,
  version: newVersion,
  releaseCounter: newCounter,
  updatedAt: now,
  source: 'bump-version',
  previousVersion: versionChanged ? currentVersion : (manifest.previousVersion || null),
  previousCounter: versionChanged ? currentCounter : (manifest.previousCounter || null),
};

writeJson(MANIFEST_PATH, newManifest);

// ─── Atualizar .deploy-state.json ───────────────────────────────────────────
const newDeployState = {
  ...deployState,
  schemaVersion: 1,
  status: 'active',
  version: newVersion,
  releaseCounter: newCounter,
  deployedAt: now,
  sourceUpdatedAt: now,
};

writeJson(DEPLOY_STATE_PATH, newDeployState);

// ─── Atualizar version no package.json raiz (opcional) ─────────────────────
if (packageJson.version) {
  packageJson.version = newVersion;
  writeJson(PACKAGE_JSON_PATH, packageJson);
  console.log(`📦 package.json atualizado → ${newVersion}`);
}

// ─── Resumo ─────────────────────────────────────────────────────────────────
console.log('');
console.log('✅ Versão atualizada com sucesso!');
console.log('');
if (versionChanged) {
  console.log(`   Versão anterior : ${currentVersion} #${currentCounter}`);
  console.log(`   Nova versão     : ${newVersion} #${newCounter}  ← NOVO RELEASE`);
} else {
  console.log(`   Versão          : ${newVersion}`);
  console.log(`   Contador        : #${currentCounter} → #${newCounter}`);
}
console.log(`   Data/hora       : ${formatDateBR(now)}`);
console.log('');
console.log(`   Arquivos atualizados:`);
console.log(`   • Version/release-manifest.json`);
console.log(`   • .deploy-state.json`);
if (packageJson.version) console.log(`   • package.json`);
console.log('');
console.log('   Reinicie o servidor para refletir no StatusBar.');
console.log('');
