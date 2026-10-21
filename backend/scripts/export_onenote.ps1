param([Parameter(Mandatory=$true)][string]$SectionsManifest,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$application = $null
$stage = 'connect'
$sectionName = ''
$pageName = ''
$deadline = [DateTime]::UtcNow.AddSeconds(170)

function Get-ComFailure($exception) {
    while ($exception.InnerException) { $exception = $exception.InnerException }
    return $exception
}
function Save-Progress {
    ConvertTo-Json -InputObject @{stage=$script:stage; section=$script:sectionName; page=$script:pageName} -Compress |
        Set-Content -LiteralPath (Join-Path $OutputDirectory 'progress.json') -Encoding UTF8
}
function Invoke-OneNote([scriptblock]$Operation) {
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        try { return (& $Operation) } catch {
            $failure = Get-ComFailure $_.Exception
            $code = $failure.HResult.ToString('X8')
            # Retry only transient COM busy/startup errors, never malformed or protected pages.
            if ($code -notin @('80010001', '8001010A', '8001010B', '800706BA') -or $attempt -eq 9 -or [DateTime]::UtcNow -ge $script:deadline) { throw }
            Start-Sleep -Milliseconds ([Math]::Min(2000, 300 * ($attempt + 1)))
        }
    }
}
try {
    Save-Progress
    $application = Invoke-OneNote { New-Object -ComObject OneNote.Application }
    $pages = @()
    $warnings = @()
    $sectionPaths = @(Get-Content -LiteralPath $SectionsManifest -Raw -Encoding UTF8 | ConvertFrom-Json)
    if (!$sectionPaths.Count) { throw 'No OneNote sections were found in this file.' }
    foreach ($sectionPath in $sectionPaths) {
        $section = Get-Item -LiteralPath $sectionPath
        $sectionName = $section.BaseName
        $pageName = ''
        $stage = 'open-section'; Save-Progress
        # Typed strings map the out parameters to COM BSTRs. Return the value from
        # the retry scope rather than relying on a reference in a child scope.
        [string]$sectionId = Invoke-OneNote {
            [string]$openedId = ''
            $application.OpenHierarchy([string]$section.FullName, [string]'', [ref]$openedId, 0)
            return $openedId
        }
        if (!$sectionId) { throw 'OneNote returned no section ID.' }
        try {
            $stage = 'read-pages'; Save-Progress
            $nodes = @()
            # OpenHierarchy can return before the section's page index is loaded.
            # A successful COM call with an empty index must also be retried.
            for ($loadAttempt = 0; $loadAttempt -lt 6; $loadAttempt++) {
                [string]$hierarchy = Invoke-OneNote {
                    [string]$pageXml = ''
                    $application.GetHierarchy([string]$sectionId, 4, [ref]$pageXml, 2)
                    return $pageXml
                }
                if ($hierarchy.Trim()) {
                    [xml]$xml = $hierarchy
                    $sectionNode = $xml.SelectSingleNode("//*[local-name()='Section']")
                    if ($sectionNode -and $sectionNode.GetAttribute('isLocked') -eq 'true') { throw 'This section is locked. Unlock it in desktop OneNote before exporting.' }
                    $nodes = @($xml.SelectNodes("//*[local-name()='Page' and not(@isInRecycleBin='true')]"))
                }
                if ($nodes.Count -or [DateTime]::UtcNow -ge $deadline) { break }
                if ($loadAttempt -lt 5) { Start-Sleep -Milliseconds (400 * ($loadAttempt + 1)) }
            }
            $wholeSection = !$nodes.Count
            if ($wholeSection) {
                # Publish accepts any hierarchy ID, including a section. Its native
                # renderer can export every page even when GetHierarchy's index is empty.
                # Do not rebuild this section with the lossy text/ink parser.
                [xml]$fallback = '<Section />'
                $fallback.DocumentElement.SetAttribute('ID', $sectionId)
                $fallback.DocumentElement.SetAttribute('name', $sectionName)
                $nodes = @($fallback.DocumentElement)
                $warnings += ('OneNote did not list individual pages for "' + $sectionName + '". The entire section was exported together; all PDF sheets are included. Select this section to keep all its pages.')
            }
            foreach ($node in $nodes) {
                if ([DateTime]::UtcNow -ge $deadline) { throw 'The export exceeded its time limit. Import smaller sections.' }
                if ($pages.Count -ge 200) { throw 'This notebook exceeds the 200 source-page limit. Export smaller sections.' }
                $pageName = $node.GetAttribute('name')
                $stage = if ($wholeSection) { 'export-section' } else { 'export-page' }; Save-Progress
                [string]$pageId = $node.GetAttribute('ID')
                if (!$pageId) { throw 'OneNote returned a page without an ID.' }
                $target = Join-Path $OutputDirectory (('page-{0:D4}.pdf' -f $pages.Count))
                Invoke-OneNote {
                    # A retry can follow an interrupted publish. Remove only this attempt's output.
                    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
                    # Omit the optional third-party exporter CLSID for built-in PDF publishing.
                    $application.Publish([string]$pageId, [string]$target, 3)
                }
                if (!(Test-Path -LiteralPath $target) -or (Get-Item -LiteralPath $target).Length -eq 0) { throw 'OneNote did not produce a PDF for this page. No partial document was saved.' }
                $pages += @{title=$pageName; section=$sectionName; pdfFile=[System.IO.Path]::GetFileName($target); sourceKind=$(if ($wholeSection) { 'section' } else { 'page' })}
                $total = (Get-ChildItem -LiteralPath $OutputDirectory -File -Filter '*.pdf' | Measure-Object -Property Length -Sum).Sum
                if ($total -gt 18MB) { throw 'The exported notes exceed the import size limit. Import smaller sections.' }
            }
        } finally {
            # Do not force-close or discard changes in OneNote.
            if ($sectionId) { try { $application.CloseNotebook([string]$sectionId, $false) } catch {} }
        }
    }
    if (!$pages.Count) { throw 'No pages could be exported.' }
    $stage = 'complete'; Save-Progress
    ConvertTo-Json -InputObject @{pages=@($pages); warnings=@($warnings)} -Depth 5 -Compress | Set-Content -LiteralPath (Join-Path $OutputDirectory 'manifest.json') -Encoding UTF8
} catch {
    $failure = Get-ComFailure $_.Exception
    $code = $failure.HResult.ToString('X8')
    $hint = switch ($code) {
        '80040154' { 'Desktop OneNote automation is not registered. Repair the desktop OneNote/Office installation.' }
        '80080005' { 'OneNote could not start under the backend Windows account. Run both under the same signed-in account and elevation level.' }
        '80070005' { 'OneNote denied access. Run both under the same signed-in account and elevation level.' }
        '8002801D' { 'The Office automation type library is not registered. Repair the desktop OneNote/Office installation.' }
        default { 'The original OneNote error is shown below; no partial document was saved.' }
    }
    ConvertTo-Json -InputObject @{stage=$stage; section=$sectionName; page=$pageName; code=$code; message=$failure.Message; hint=$hint} -Compress |
        Set-Content -LiteralPath (Join-Path $OutputDirectory 'error.json') -Encoding UTF8
    [Console]::Error.WriteLine($failure.Message)
    exit 1
} finally {
    if ($null -ne $application) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($application) }
}
