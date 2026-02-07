$ErrorActionPreference = "Stop"

$VPS_USER = "root"
$VPS_HOST = "185.202.223.115"
$DB_USER = "drx"
$DB_PASS = "drx_secure_pass_123"
$DB_NAME = "drx_db"
$LOCAL_CONTAINER = "drx_db_local"
$LOCAL_DB_USER = "drx_dev"
$LOCAL_DB_NAME = "drx_local"
$BACKUP_FILE = "backups/vps_backup.sql"

# Ensure backups directory exists
if (-not (Test-Path "backups")) {
    New-Item -ItemType Directory -Force -Path "backups" | Out-Null
}

Write-Host "=== INICIANDO SINCRONIZAÇÃO DA VPS ===" -ForegroundColor Cyan
Write-Host "1. Conectando na VPS ($VPS_HOST) para gerar dump..." -ForegroundColor Yellow
Write-Host "   Nota: Você precisará digitar a senha da VPS se solicitada." -ForegroundColor Gray

# Command to run on VPS
# We use PGPASSWORD inline to avoid prompt
$remote_cmd = "PGPASSWORD='$DB_PASS' pg_dump -U $DB_USER -h localhost -d $DB_NAME --clean --if-exists --no-owner --no-privileges"

# Run SSH and pipe output to file. Using cmd /c to handle piping reliability in PS.
# We treat the ssh command as a native command string for cmd
$ssh_cmd = "ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST ""$remote_cmd"" > $BACKUP_FILE"

cmd /c $ssh_cmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "2. Dump salvo com sucesso em: $BACKUP_FILE" -ForegroundColor Green
    
    Write-Host "3. Restaurando para o container local ($LOCAL_CONTAINER)..." -ForegroundColor Yellow
    # Restore to local docker
    # We pipe the file content to docker exec
    Get-Content $BACKUP_FILE | docker exec -i $LOCAL_CONTAINER psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME
    
    Write-Host "=== SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO! ===" -ForegroundColor Green
} else {
    Write-Host "ERRO: Falha ao baixar o backup da VPS." -ForegroundColor Red
}
