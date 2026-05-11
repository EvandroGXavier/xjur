# =============================================================================
# aplicar-migration-contatos.ps1
# Aplica os indices de performance do modulo Contatos no banco drx_local.
# Execute com: .\aplicar-migration-contatos.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$MIGRATION_FILE = "$PSScriptRoot\packages\database\prisma\migrations\20260510_contact_indexes\migration.sql"
$CONTAINER = "drx2-postgres-1"
$DB_USER = "drx_dev"
$DB_NAME = "drx_local"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  DR.X - Migration 20260510_contact_indexes" -ForegroundColor Cyan
Write-Host "  Indices compostos de performance em contacts" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o container esta rodando
$running = docker ps --filter "name=$CONTAINER" --filter "status=running" --format "{{.Names}}" 2>$null
if (-not $running) {
    Write-Host "Container $CONTAINER nao esta rodando." -ForegroundColor Red
    Write-Host "Inicie o stack EVO CRM primeiro: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "Container $CONTAINER OK." -ForegroundColor Green
Write-Host ""

# Copiar SQL para dentro do container
Write-Host "Copiando migration para o container..." -ForegroundColor Gray
docker cp $MIGRATION_FILE "${CONTAINER}:/tmp/migration_20260510_contacts.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: docker cp falhou." -ForegroundColor Red
    exit 1
}

# Aplicar migration
Write-Host "Aplicando migration..." -ForegroundColor Gray
Write-Host ""
docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -f /tmp/migration_20260510_contacts.sql
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO: psql falhou dentro do container." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "  Migration aplicada com sucesso!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
