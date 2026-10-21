param([Parameter(Mandatory=$true)][string]$SectionsManifest,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$application = $null
try {
    $application = New-Object -ComObject OneNote.Application
    $pages = @()
    $sectionPaths = @(Get-Content -LiteralPath $SectionsManifest -Raw -Encoding UTF8 | ConvertFrom-Json)
    $sections = @($sectionPaths | ForEach-Object { Get-Item -LiteralPath $_ })
    if (!$sections.Count) { throw 'No OneNote sections were found in this file.' }
    foreach ($section in $sections) {
        $sectionId = ''
        try {
            $application.OpenHierarchy($section.FullName, '', [ref]$sectionId, 0)
            $hierarchy = ''
            $application.GetHierarchy($sectionId, 4, [ref]$hierarchy)
            [xml]$xml = $hierarchy
            $nodes = @($xml.SelectNodes("//*[local-name()='Page']"))
            foreach ($node in $nodes) {
                if ($pages.Count -ge 200) { throw 'This notebook exceeds the 200 source-page limit. Export smaller sections.' }
                if ($node.GetAttribute('isInRecycleBin') -eq 'true') { continue }
                $target = Join-Path $OutputDirectory (('page-{0:D4}.pdf' -f $pages.Count))
                # OneNote itself renders ink, highlights, printouts, and their original placement.
                $application.Publish($node.GetAttribute('ID'), $target, 3, '')
                if (!(Test-Path -LiteralPath $target)) { throw 'OneNote did not export a page. The import was stopped to avoid losing it.' }
                $pages += @{title=$node.GetAttribute('name'); section=$section.BaseName; pdfFile=[System.IO.Path]::GetFileName($target)}
                $total = (Get-ChildItem -LiteralPath $OutputDirectory -File -Filter '*.pdf' | Measure-Object -Property Length -Sum).Sum
                if ($total -gt 18MB) { throw 'The exported notes exceed the import size limit. Export smaller sections.' }
            }
        } finally {
            # Only close the temporary uploaded section, never an existing user notebook.
            if ($sectionId) { try { $application.CloseNotebook($sectionId, $true) } catch {} }
        }
    }
    if (!$pages.Count) { throw 'No pages could be exported. Unlock protected sections in OneNote and export them again.' }
    ConvertTo-Json -InputObject @{pages=@($pages)} -Depth 5 -Compress | Set-Content -LiteralPath (Join-Path $OutputDirectory 'manifest.json') -Encoding UTF8
} catch {
    [Console]::Error.WriteLine('OneNote desktop export failed: ' + $_.Exception.Message)
    exit 1
} finally {
    if ($null -ne $application) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($application) }
}
