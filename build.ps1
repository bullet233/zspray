$css = Get-Content "$PSScriptRoot\styles.css" -Raw
$js = Get-Content "$PSScriptRoot\app.js" -Raw
$html = Get-Content "$PSScriptRoot\index.html" -Raw

$html = $html.Replace('<link rel="stylesheet" href="styles.css">', "<style>`n$css`n</style>")
$html = $html.Replace('<script src="app.js"></script>', "<script>`n$js`n</script>")

$outPath = "C:\Users\dylan\Downloads\zspray_calibration_v2.html"
Set-Content -Path $outPath -Value $html -Encoding UTF8
Write-Host "Built: $outPath"
