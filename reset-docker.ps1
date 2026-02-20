
# Script de Reset do Ambiente Docker para Desenvolvimento (Dr.X)
# Objetivo: Limpar portas presas, reiniciar containers e garantir estabilidade.

Write-Host "🛑 Parando serviços Docker..." -ForegroundColor Yellow
docker-compose down --remove-orphans

Write-Host "🧹 Limpando processos zumbis nas portas críticas..." -ForegroundColor Yellow

# Função para matar processo por porta
function Kill-PortProcess {
    param([string]$Port)
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($process) {
        $pidVal = $process.OwningProcess
        Write-Host "   -> Matando processo na porta $Port (PID: $pidVal)..." -ForegroundColor Red
        Stop-Process -Id $pidVal -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "   -> Porta $Port está livre." -ForegroundColor Green
    }
}

Kill-PortProcess "3000" # API NestJS
Kill-PortProcess "5173" # Web Frontend
Kill-PortProcess "5174" # Extension Frontend
Kill-PortProcess "8080" # Evolution API (se rodando localmente fora do docker)
Kill-PortProcess "5432" # Postgres (se rodando localmente fora do docker)
Kill-PortProcess "6379" # Redis (se rodando localmente fora do docker)

Write-Host "🚀 Iniciando Containers Docker (DB, Redis, Evolution)..." -ForegroundColor Cyan
docker-compose up -d --force-recreate --remove-orphans

Write-Host "⏳ Aguardando serviços subirem (Healthchecks)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

docker-compose ps

Write-Host "✅ Ambiente Docker Reiniciado com Sucesso!" -ForegroundColor Green
Write-Host "👉 Agora você pode rodar 'npm run dev' em outro terminal para subir a API e o Frontend." -ForegroundColor White
