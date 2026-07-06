# Genera dist/api-lambda.zip listo para subir a AWS Lambda.
# Uso (desde la raíz del repo):  pnpm package:lambda
# Resultado: dist/lambda/ (carpeta desplegable) y dist/api-lambda.zip
# Handler a configurar en Lambda: src/lambda.handler

$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$origen = Join-Path $raiz "apps\api"
$destino = Join-Path $raiz "dist\lambda"
$zip = Join-Path $raiz "dist\api-lambda.zip"

if (Test-Path $destino) { Remove-Item $destino -Recurse -Force }
New-Item -ItemType Directory -Force -Path $destino | Out-Null

Copy-Item (Join-Path $origen "src") (Join-Path $destino "src") -Recurse
Copy-Item (Join-Path $origen "package.json") $destino

# Instala solo dependencias de producción con node_modules "reales" (sin symlinks de pnpm)
Push-Location $destino
try {
    npm install --omit=dev --no-package-lock --loglevel=error
} finally {
    Pop-Location
}

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $destino "*") -DestinationPath $zip

Write-Host ""
Write-Host "Paquete listo: $zip"
Write-Host "Handler para Lambda: src/lambda.handler"
