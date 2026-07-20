# =====================================================
# Farmers Farm - Google Client ID Update Script
# =====================================================
# Usage: .\update-google-id.ps1 -ClientId "YOUR_ACTUAL_CLIENT_ID"
# Example: .\update-google-id.ps1 -ClientId "123456789-abc.apps.googleusercontent.com"

param(
    [Parameter(Mandatory=$true)]
    [string]$ClientId
)

$files = @(
    "d:\farners farm\public\index.html",
    "d:\farners farm\public\login.html",
    "d:\farners farm\public\cart.html",
    "d:\farners farm\public\farmers-farm.html"
)

Write-Host "Updating Google Client ID in all HTML files..." -ForegroundColor Cyan

foreach ($file in $files) {
    $content = Get-Content $file -Raw -Encoding UTF8
    $updated = $content -replace 'YOUR_GOOGLE_CLIENT_ID_HERE', $ClientId
    Set-Content -Path $file -Value $updated -Encoding UTF8 -NoNewline
    Write-Host "  Updated: $file" -ForegroundColor Green
}

# Also update .env
$envFile = "d:\farners farm\backend\.env"
$envContent = Get-Content $envFile -Raw -Encoding UTF8
$envUpdated = $envContent -replace 'GOOGLE_CLIENT_ID=.*', "GOOGLE_CLIENT_ID=$ClientId"
Set-Content -Path $envFile -Value $envUpdated -Encoding UTF8 -NoNewline

Write-Host "  Updated: $envFile" -ForegroundColor Green
Write-Host ""
Write-Host "SUCCESS! Google Client ID updated in all files." -ForegroundColor Green
Write-Host "Client ID: $ClientId" -ForegroundColor Yellow
