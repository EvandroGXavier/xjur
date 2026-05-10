# =============================================================================
# apply-migration-20260510.ps1
# Aplica a migration de índices e externalKey do módulo de Processos.
# Execute com: .\apply-migration-20260510.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$MIGRATION_FILE = "$PSScriptRoot\packages\database\prisma\migrations\20260510_process_indexes_and_externalkey\migration.sql"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  DR.X — Migration 20260510" -ForegroundColor Cyan
Write-Host "  Índices de performance + coluna externalKey" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# --- Detectar DATABASE_URL ---
$dbUrl = $env:DATABASE_URL

if (-not $dbUrl) {
    # Tentar ler do .env da API
    $envFile = "$PSScriptRoot\apps\api\.env"
    if (Test-Path $envFile) {
        $lines = Get-Content $envFile
        foreach ($line in $lines) {
            if ($line -match "^DATABASE_URL\s*=\s*(.+)$") {
                $dbUrl = $matches[1].Trim().Trim('"')
                Write-Host "DATABASE_URL lido de: $envFile" -ForegroundColor Gray
                break
            }
        }
    }
}

if (-not $dbUrl) {
    Write-Host "DATABASE_URL nao encontrado. Usando valor padrao local..." -ForegroundColor Yellow
    $dbUrl = "postgresql://drx_dev:drx_local_pass@localhost:5432/drx_local"
}

Write-Host "Banco alvo: $($dbUrl -replace ':([^:@]+)@', ':***@')" -ForegroundColor Gray
Write-Host ""

# --- Verificar se psql esta disponível ---
$psqlPath = $null
$candidates = @(
    "psql",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe"
)

foreach ($c in $candidates) {
    try {
        $null = & $c --version 2>&1
        $psqlPath = $c
        break
    } catch { }
}

if ($psqlPath) {
    Write-Host "Aplicando migration via psql..." -ForegroundColor Green
    Write-Host ""
    & $psqlPath $dbUrl -f $MIGRATION_FILE
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Migration aplicada com sucesso via psql!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Erro ao aplicar migration via psql (codigo $LASTEXITCODE)." -ForegroundColor Red
        exit 1
    }
} else {
    # Fallback: aplicar via Docker (container do banco)
    Write-Host "psql nao encontrado localmente. Tentando via Docker..." -ForegroundColor Yellow
    Write-Host ""

    # Detectar nome do container postgres
    $container = docker ps --format "{{.Names}}" 2>/dev/null | Select-String "postgres|db" | Select-Object -First 1
    if (-not $container) {
        $container = "drx_db_local"
    }

    Write-Host "Container alvo: $container" -ForegroundColor Gray
    Write-Host ""

    # Copiar o arquivo SQL para dentro do container e executar
    docker cp $MIGRATION_FILE "${container}:/tmp/migration_20260510.sql"
    docker exec $container psql -U drx_dev -d drx_local -f /tmp/migration_20260510.sql

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Migration aplicada com sucesso via Docker!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Erro ao aplicar migration via Docker (codigo $LASTEXITCODE)." -ForegroundColor Red
        Write-Host ""
        Write-Host "Execute manualmente:" -ForegroundColor Yellow
        Write-Host "  docker exec -i <container_postgres> psql -U drx_dev -d drx_local < `"$MIGRATION_FILE`"" -ForegroundColor White
        exit 1
    }
}

Write-Host ""
Write-Host "Regenerando Prisma Client..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\packages\database"
npx prisma generate

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "  Tudo pronto! Migration 20260510 concluida." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
