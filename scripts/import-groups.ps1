# Usage: .\scripts\import-groups.ps1
param(
  [string]$FilePath
)

if (-not $FilePath) {
  Write-Host "اسحب ملف اللينكات على السكريبت ده"
  exit 1
}

npx tsx scripts\import-groups.ts $FilePath
