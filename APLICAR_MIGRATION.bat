@echo off
setlocal

set CONTAINER=drx_db_local
set DB_USER=drx_dev
set DB_NAME=drx_local
set MIGRATION=packages\database\prisma\migrations\20260510_process_indexes_and_externalkey\migration.sql

cd /d "%~dp0"

echo.
echo DR.X - Migration 20260510
echo.

:: Verificar se o container esta rodando
docker ps --filter name=%CONTAINER% --filter status=running --format "{{.Names}}" | findstr /i "%CONTAINER%" > nul 2>&1
if %errorlevel% neq 0 (
    echo Container %CONTAINER% nao esta rodando. Iniciando...
    docker-compose up -d db
    echo Aguardando o banco ficar pronto...
    timeout /t 8 /nobreak > nul
    docker ps --filter name=%CONTAINER% --filter status=running --format "{{.Names}}" | findstr /i "%CONTAINER%" > nul 2>&1
    if %errorlevel% neq 0 (
        echo ERRO: container ainda nao esta rodando apos inicializar.
        pause
        exit /b 1
    )
) else (
    echo Container %CONTAINER% ja esta rodando.
)

echo.

:: Copiar SQL para dentro do container
docker cp "%MIGRATION%" "%CONTAINER%:/tmp/migration_20260510.sql"
if %errorlevel% neq 0 (
    echo ERRO: docker cp falhou.
    pause
    exit /b 1
)

:: Aplicar migration
docker exec %CONTAINER% psql -U %DB_USER% -d %DB_NAME% -f /tmp/migration_20260510.sql
if %errorlevel% neq 0 (
    echo ERRO: psql falhou dentro do container.
    pause
    exit /b 1
)

echo.
echo Migration aplicada com sucesso!
echo.

:: Regenerar Prisma Client
echo Gerando Prisma Client...
cd packages\database
call npx prisma generate
cd /d "%~dp0"

echo.
echo Concluido!
echo.
pause
