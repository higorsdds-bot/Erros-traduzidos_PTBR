# Publica a extensão no VS Code Marketplace e no Open VSX (Antigravity, Cursor...).
#
# Uso:   .\publicar.ps1            -> publica a versão atual do package.json
#        .\publicar.ps1 patch      -> sobe a versão (0.1.0 -> 0.1.1) e publica
#        .\publicar.ps1 minor      -> sobe a versão (0.1.0 -> 0.2.0) e publica
#
# Tokens (salve uma vez com setx e reabra o terminal/VS Code):
#   setx VSCE_PAT "token do Azure DevOps"   -> VS Code Marketplace
#   setx OVSX_PAT "token do open-vsx.org"   -> Open VSX

param([ValidateSet('', 'patch', 'minor', 'major')][string]$Versao = '')

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Read-Token($nome) {
  $valor = [Environment]::GetEnvironmentVariable($nome, 'Process')
  if (-not $valor) { $valor = [Environment]::GetEnvironmentVariable($nome, 'User') }
  return $valor
}

$vscePat = Read-Token 'VSCE_PAT'
$ovsxPat = Read-Token 'OVSX_PAT'
if (-not $vscePat -and -not $ovsxPat) {
  Write-Host 'Nenhum token encontrado. Salve com: setx VSCE_PAT "..." e/ou setx OVSX_PAT "..."' -ForegroundColor Red
  exit 1
}

Write-Host '==> Testando o dicionário' -ForegroundColor Cyan
node teste-dicionario.js | Select-Object -Last 1
if ($LASTEXITCODE -ne 0) { throw 'O teste do dicionário falhou.' }

Write-Host '==> Testando o analisador de causa' -ForegroundColor Cyan
node teste-analisador.js | Select-Object -Last 1
if ($LASTEXITCODE -ne 0) { throw 'O teste do analisador falhou (rode node teste-analisador.js para ver os detalhes).' }

Write-Host '==> Testando a leitura de erros colados' -ForegroundColor Cyan
node teste-erro-colado.js | Select-Object -Last 1
if ($LASTEXITCODE -ne 0) { throw 'O teste de erros colados falhou (rode node teste-erro-colado.js para ver os detalhes).' }

Write-Host '==> Testando projetos com várias camadas (Express)' -ForegroundColor Cyan
node teste-projetos.js | Select-Object -Last 1
if ($LASTEXITCODE -ne 0) { throw 'O teste de projetos falhou (rode node teste-projetos.js para ver os detalhes).' }

Write-Host '==> Testando a identificação de camadas (model, controller, rota...)' -ForegroundColor Cyan
node teste-camadas.js | Select-Object -Last 1
if ($LASTEXITCODE -ne 0) { throw 'O teste de camadas falhou (rode node teste-camadas.js para ver os detalhes).' }

if ($Versao) {
  Write-Host "==> Subindo a versão ($Versao)" -ForegroundColor Cyan
  npm version $Versao --no-git-tag-version | Out-Null
}

$pacote = Get-Content package.json -Raw | ConvertFrom-Json
$vsix = "$($pacote.name)-$($pacote.version).vsix"
Write-Host "==> Gerando $vsix" -ForegroundColor Cyan
Remove-Item *.vsix -ErrorAction SilentlyContinue
npx --yes @vscode/vsce package --out $vsix
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o pacote.' }

$resultado = @()

if ($vscePat) {
  Write-Host '==> Publicando no VS Code Marketplace' -ForegroundColor Cyan
  npx --yes @vscode/vsce publish --packagePath $vsix --pat $vscePat
  $resultado += if ($LASTEXITCODE -eq 0) { "VS Code Marketplace: OK  -> https://marketplace.visualstudio.com/items?itemName=$($pacote.publisher).$($pacote.name)" } else { 'VS Code Marketplace: FALHOU (veja a mensagem acima)' }
} else {
  $resultado += 'VS Code Marketplace: pulado (sem VSCE_PAT). Dá para enviar o .vsix em https://marketplace.visualstudio.com/manage'
}

if ($ovsxPat) {
  Write-Host '==> Publicando no Open VSX' -ForegroundColor Cyan
  $existe = $true
  try { Invoke-WebRequest "https://open-vsx.org/api/$($pacote.publisher)" -UseBasicParsing | Out-Null } catch { $existe = $false }
  if (-not $existe) {
    Write-Host "   Criando o namespace $($pacote.publisher)"
    npx --yes ovsx create-namespace $pacote.publisher -p $ovsxPat
  }
  npx --yes ovsx publish $vsix -p $ovsxPat
  $resultado += if ($LASTEXITCODE -eq 0) { "Open VSX: OK  -> https://open-vsx.org/extension/$($pacote.publisher)/$($pacote.name)" } else { 'Open VSX: FALHOU (veja a mensagem acima)' }
} else {
  $resultado += 'Open VSX: pulado (sem OVSX_PAT)'
}

Write-Host ''
Write-Host "==> Resultado (versão $($pacote.version))" -ForegroundColor Green
$resultado | ForEach-Object { Write-Host "   $_" }
