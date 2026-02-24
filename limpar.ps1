# Script de Manutenção Habitual - DR.X
Write-Host "--- Iniciando Limpeza Profunda do DR.X ---" -ForegroundColor Cyan

# 1. Mata processos que prendem arquivos
Write-Host "Encerrando processos Node e Turbo..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "turbo" -Force -ErrorAction SilentlyContinue

# 2. Remove pastas de cache e node_modules problemáticas
Write-Host "Removendo arquivos temporários e caches..." -ForegroundColor Yellow
$pastas = @(
    "node_modules", 
    ".turbo", 
    "apps/web/node_modules", 
    "apps/api/node_modules", 
    "packages/database/node_modules"
)

foreach ($pasta in $pastas) {
    if (Test-Path $pasta) {
        cmd /c "rmdir /s /q $pasta"
    }
}

# 3. Reinstalação limpa
Write-Host "Reinstalando dependências..." -ForegroundColor Yellow
npm install

# 4. Preparação do Banco
Write-Host "Gerando Cliente do Banco (Prisma)..." -ForegroundColor Yellow
npx turbo run db:generate

Write-Host "--- SISTEMA PRONTO PARA USO ---" -ForegroundColor Green
Write-Host "Agora você pode rodar: npm run dev" -ForegroundColor Cyan