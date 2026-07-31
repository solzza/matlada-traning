Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourcePath = 'C:\Users\Fredrik\Downloads\LivsmedelsDB_202605171308 (1).xlsx'
$workspace = 'C:\Users\Fredrik\Documents\Codex\2026-05-17\https-chatgpt-com-share-6a099ff2-8430'
$outputPath = Join-Path $workspace 'MatladsKalkylator.xlsx'

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Web

function Assert-InWorkspace {
    param([string] $Path)
    $resolvedWorkspace = [System.IO.Path]::GetFullPath($workspace)
    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    if (-not $resolvedPath.StartsWith($resolvedWorkspace, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to write outside workspace: $resolvedPath"
    }
}

function XmlEscape {
    param($Value)
    if ($null -eq $Value) { return '' }
    return [System.Security.SecurityElement]::Escape([string]$Value)
}

function Get-ColIndex {
    param([string] $CellRef)
    $letters = ([regex]::Match($CellRef, '^[A-Z]+')).Value
    $n = 0
    foreach ($ch in $letters.ToCharArray()) {
        $n = $n * 26 + ([int][char]$ch - [int][char]'A' + 1)
    }
    return $n
}

function Get-ColName {
    param([int] $Index)
    $name = ''
    $n = $Index
    while ($n -gt 0) {
        $n--
        $name = [char](65 + ($n % 26)) + $name
        $n = [math]::Floor($n / 26)
    }
    return $name
}

function Read-ZipEntryText {
    param(
        [System.IO.Compression.ZipArchive] $Zip,
        [string] $Name
    )
    $entry = $Zip.GetEntry($Name)
    if ($null -eq $entry) { return $null }
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    try {
        return $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

function Get-CellValue {
    param(
        [System.Xml.XmlElement] $Cell,
        [string[]] $SharedStrings
    )
    $type = $Cell.GetAttribute('t')
    if ($type -eq 'inlineStr') {
        return $Cell.InnerText
    }

    $valueNode = $Cell.GetElementsByTagName('v') | Select-Object -First 1
    if ($null -eq $valueNode) {
        return ''
    }

    $raw = $valueNode.InnerText
    if ($type -eq 's' -and $raw -ne '') {
        return $SharedStrings[[int]$raw]
    }
    return $raw
}

function Read-SourceRows {
    param([string] $Path)

    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $shared = New-Object System.Collections.Generic.List[string]
        $sharedText = Read-ZipEntryText -Zip $zip -Name 'xl/sharedStrings.xml'
        if ($sharedText) {
            [xml]$sharedXml = $sharedText
            foreach ($si in $sharedXml.DocumentElement.ChildNodes) {
                [void]$shared.Add($si.InnerText)
            }
        }

        [xml]$workbookXml = Read-ZipEntryText -Zip $zip -Name 'xl/workbook.xml'
        [xml]$relsXml = Read-ZipEntryText -Zip $zip -Name 'xl/_rels/workbook.xml.rels'
        $relMap = @{}
        foreach ($rel in $relsXml.DocumentElement.ChildNodes) {
            $relMap[$rel.Id] = $rel.Target
        }

        $sheets = $workbookXml.DocumentElement.GetElementsByTagName('sheet')
        if ($sheets.Count -ne 1) {
            throw "Expected 1 source sheet, found $($sheets.Count)."
        }

        $sheet = $sheets | Select-Object -First 1
        $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $target = $relMap[$rid]
        if ($target.StartsWith('/')) {
            $sheetPath = $target.TrimStart('/')
        }
        elseif ($target.StartsWith('xl/')) {
            $sheetPath = $target
        }
        else {
            $sheetPath = 'xl/' + $target
        }

        [xml]$sheetXml = Read-ZipEntryText -Zip $zip -Name $sheetPath
        $rows = New-Object System.Collections.Generic.List[object]
        foreach ($row in $sheetXml.DocumentElement.GetElementsByTagName('row')) {
            $rowNumber = [int]$row.r
            if ($rowNumber -lt 3) { continue }

            $values = @{}
            foreach ($cell in $row.GetElementsByTagName('c')) {
                $colIndex = Get-ColIndex $cell.r
                if ($colIndex -le 11) {
                    $values[$colIndex] = Get-CellValue -Cell $cell -SharedStrings $shared.ToArray()
                }
            }

            $record = [ordered]@{}
            for ($i = 1; $i -le 11; $i++) {
                $record[(Get-ColName $i)] = if ($values.ContainsKey($i)) { $values[$i] } else { '' }
            }
            [void]$rows.Add([pscustomobject]$record)
        }

        return $rows
    }
    finally {
        $zip.Dispose()
    }
}

function New-TextCell {
    param(
        [int] $Row,
        [int] $Col,
        $Value,
        [int] $Style = 0
    )
    $ref = "$(Get-ColName $Col)$Row"
    $styleText = if ($Style -gt 0) { " s=`"$Style`"" } else { '' }
    return "<c r=`"$ref`" t=`"inlineStr`"$styleText><is><t>$(XmlEscape $Value)</t></is></c>"
}

function New-NumberCell {
    param(
        [int] $Row,
        [int] $Col,
        $Value,
        [int] $Style = 0
    )
    $ref = "$(Get-ColName $Col)$Row"
    $styleText = if ($Style -gt 0) { " s=`"$Style`"" } else { '' }
    $number = if ($null -eq $Value -or [string]$Value -eq '') { '' } else { ([string]$Value).Replace(',', '.') }
    if ($number -eq '') {
        return "<c r=`"$ref`"$styleText/>"
    }
    return "<c r=`"$ref`"$styleText><v>$number</v></c>"
}

function New-FormulaCell {
    param(
        [int] $Row,
        [int] $Col,
        [string] $Formula,
        [int] $Style = 0
    )
    $ref = "$(Get-ColName $Col)$Row"
    $styleText = if ($Style -gt 0) { " s=`"$Style`"" } else { '' }
    return "<c r=`"$ref`"$styleText><f>$(XmlEscape $Formula)</f></c>"
}

function New-RowXml {
    param(
        [int] $Row,
        [string[]] $Cells,
        [double] $Height = 0
    )
    $heightText = if ($Height -gt 0) { " ht=`"$Height`" customHeight=`"1`"" } else { '' }
    return "<row r=`"$Row`"$heightText>$($Cells -join '')</row>"
}

function Build-Sheet {
    param(
        [string] $Dimension,
        [string] $ColsXml,
        [string[]] $RowsXml,
        [string] $ExtraXml = '',
        [int] $FreezeRow = 0
    )

    $sheetView = if ($FreezeRow -gt 0) {
        "<sheetViews><sheetView workbookViewId=`"0`"><pane ySplit=`"$FreezeRow`" topLeftCell=`"A$($FreezeRow + 1)`" activePane=`"bottomLeft`" state=`"frozen`"/></sheetView></sheetViews>"
    }
    else {
        '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
    }

    return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="$Dimension"/>
  $sheetView
  <sheetFormatPr defaultRowHeight="15"/>
  $ColsXml
  <sheetData>
    $($RowsXml -join "`n    ")
  </sheetData>
  $ExtraXml
</worksheet>
"@
}

function Write-PackageFile {
    param(
        [string] $Root,
        [string] $RelativePath,
        [string] $Content
    )
    $fullPath = Join-Path $Root $RelativePath
    $dir = Split-Path $fullPath -Parent
    if (-not (Test-Path $dir)) {
        [void][System.IO.Directory]::CreateDirectory($dir)
    }
    [System.IO.File]::WriteAllText($fullPath, $Content, [System.Text.Encoding]::UTF8)
}

function Add-SheetRowsFromObjects {
    param(
        [object[]] $Rows,
        [int] $StartRow,
        [int[]] $NumericCols = @()
    )
    $xmlRows = New-Object System.Collections.Generic.List[string]
    $r = $StartRow
    foreach ($record in $Rows) {
        $cells = New-Object System.Collections.Generic.List[string]
        for ($i = 1; $i -le 11; $i++) {
            $key = Get-ColName $i
            $value = $record.$key
            if ($NumericCols -contains $i) {
                [void]$cells.Add((New-NumberCell -Row $r -Col $i -Value $value))
            }
            else {
                [void]$cells.Add((New-TextCell -Row $r -Col $i -Value $value))
            }
        }
        [void]$xmlRows.Add((New-RowXml -Row $r -Cells $cells.ToArray()))
        $r++
    }
    return $xmlRows.ToArray()
}

Assert-InWorkspace $outputPath
if (-not (Test-Path $sourcePath)) {
    throw "Source file not found: $sourcePath"
}

$sourceRows = Read-SourceRows -Path $sourcePath
$header = $sourceRows[0]
$foodRows = @($sourceRows | Select-Object -Skip 1 | Where-Object { $_.A -ne '' })

$expectedHeaders = @(
    'Livsmedelsnamn',
    'Gruppering',
    'Energi (kcal)',
    'Fett, totalt (g)',
    'Protein (g)',
    'Kolhydrater, tillgängliga (g)'
)
for ($i = 0; $i -lt $expectedHeaders.Count; $i++) {
    $col = Get-ColName ($i + 1)
    if ($header.$col -ne $expectedHeaders[$i]) {
        throw "Unexpected header in column $col. Expected '$($expectedHeaders[$i])', found '$($header.$col)'."
    }
}

$customRows = @(
    [pscustomobject][ordered]@{ A='Whey proteinpulver'; B='Eget livsmedel'; C=''; D=''; E=''; F=''; G=''; H=''; I=''; J=''; K='' },
    [pscustomobject][ordered]@{ A='Keso Supermini'; B='Eget livsmedel'; C=''; D=''; E=''; F=''; G=''; H=''; I=''; J=''; K='' },
    [pscustomobject][ordered]@{ A=''; B=''; C=''; D=''; E=''; F=''; G=''; H=''; I=''; J=''; K='' },
    [pscustomobject][ordered]@{ A=''; B=''; C=''; D=''; E=''; F=''; G=''; H=''; I=''; J=''; K='' },
    [pscustomobject][ordered]@{ A=''; B=''; C=''; D=''; E=''; F=''; G=''; H=''; I=''; J=''; K='' }
)

$listNames = New-Object System.Collections.Generic.List[string]
foreach ($row in $customRows) {
    if ($row.A -ne '') { [void]$listNames.Add($row.A) }
}
foreach ($row in $foodRows) {
    if ($row.A -ne '') { [void]$listNames.Add($row.A) }
}
$listLastRow = $listNames.Count + 1

$tmpRoot = Join-Path $workspace ('.xlsx_build_' + [guid]::NewGuid().ToString('N'))
Assert-InWorkspace $tmpRoot
[void][System.IO.Directory]::CreateDirectory($tmpRoot)

try {
    $dbHeaderCells = New-Object System.Collections.Generic.List[string]
    for ($i = 1; $i -le 11; $i++) {
        $value = $header.(Get-ColName $i)
        [void]$dbHeaderCells.Add((New-TextCell -Row 1 -Col $i -Value $value -Style 1))
    }
    $dbRowsXml = New-Object System.Collections.Generic.List[string]
    [void]$dbRowsXml.Add((New-RowXml -Row 1 -Cells $dbHeaderCells.ToArray()))
    $dbData = Add-SheetRowsFromObjects -Rows $foodRows -StartRow 2 -NumericCols @(3,4,5,6,7,8,9,10,11)
    foreach ($rowXml in $dbData) { [void]$dbRowsXml.Add($rowXml) }
    $dbCols = '<cols><col min="1" max="1" width="42" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="11" width="15" customWidth="1"/></cols>'
    $dbSheet = Build-Sheet -Dimension "A1:K$($foodRows.Count + 1)" -ColsXml $dbCols -RowsXml $dbRowsXml.ToArray() -FreezeRow 1

    $customHeaderCells = New-Object System.Collections.Generic.List[string]
    for ($i = 1; $i -le 11; $i++) {
        $value = $header.(Get-ColName $i)
        [void]$customHeaderCells.Add((New-TextCell -Row 1 -Col $i -Value $value -Style 1))
    }
    $customRowsXml = New-Object System.Collections.Generic.List[string]
    [void]$customRowsXml.Add((New-RowXml -Row 1 -Cells $customHeaderCells.ToArray()))
    $customData = Add-SheetRowsFromObjects -Rows $customRows -StartRow 2 -NumericCols @(3,4,5,6,7,8,9,10,11)
    foreach ($rowXml in $customData) { [void]$customRowsXml.Add($rowXml) }
    $customCols = '<cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/><col min="3" max="11" width="16" customWidth="1"/></cols>'
    $customSheet = Build-Sheet -Dimension 'A1:K200' -ColsXml $customCols -RowsXml $customRowsXml.ToArray() -FreezeRow 1

    $listRowsXml = New-Object System.Collections.Generic.List[string]
    [void]$listRowsXml.Add((New-RowXml -Row 1 -Cells @((New-TextCell -Row 1 -Col 1 -Value 'Livsmedel för dropdown' -Style 1))))
    $rowNumber = 2
    foreach ($name in $listNames) {
        [void]$listRowsXml.Add((New-RowXml -Row $rowNumber -Cells @((New-TextCell -Row $rowNumber -Col 1 -Value $name))))
        $rowNumber++
    }
    $listSheet = Build-Sheet -Dimension "A1:A$listLastRow" -ColsXml '<cols><col min="1" max="1" width="48" customWidth="1"/></cols>' -RowsXml $listRowsXml.ToArray() -FreezeRow 1

    $mealRowsXml = New-Object System.Collections.Generic.List[string]
    [void]$mealRowsXml.Add((New-RowXml -Row 1 -Cells @((New-TextCell -Row 1 -Col 1 -Value 'Matlåds-kalkylator' -Style 5)) -Height 24))
    [void]$mealRowsXml.Add((New-RowXml -Row 2 -Cells @(
        (New-TextCell -Row 2 -Col 1 -Value 'Receptnamn' -Style 2),
        (New-TextCell -Row 2 -Col 2 -Value 'Min matlåda')
    )))
    [void]$mealRowsXml.Add((New-RowXml -Row 3 -Cells @(
        (New-TextCell -Row 3 -Col 1 -Value 'Antal lådor' -Style 2),
        (New-NumberCell -Row 3 -Col 2 -Value 4 -Style 3)
    )))
    [void]$mealRowsXml.Add((New-RowXml -Row 4 -Cells @(
        (New-TextCell -Row 4 -Col 1 -Value 'Databasen är per 100 g. Välj rå/kokt variant som matchar hur du väger maten.' -Style 4)
    )))

    $mealHeaders = @('Livsmedel','Gram','kcal/100g','Protein/100g','Kolh/100g','Fett/100g','kcal','Protein','Kolh','Fett','Kommentar')
    $headerCells = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $mealHeaders.Count; $i++) {
        [void]$headerCells.Add((New-TextCell -Row 7 -Col ($i + 1) -Value $mealHeaders[$i] -Style 1))
    }
    [void]$mealRowsXml.Add((New-RowXml -Row 7 -Cells $headerCells.ToArray()))

    for ($r = 8; $r -le 57; $r++) {
        $cells = New-Object System.Collections.Generic.List[string]
        [void]$cells.Add((New-TextCell -Row $r -Col 1 -Value ''))
        [void]$cells.Add((New-NumberCell -Row $r -Col 2 -Value ''))
        [void]$cells.Add((New-FormulaCell -Row $r -Col 3 -Formula "IF(`$A$r=`"`",`"`",IFERROR(INDEX('Egna livsmedel'!`$C:`$C,MATCH(`$A$r,'Egna livsmedel'!`$A:`$A,0)),IFERROR(INDEX(LivsmedelsDB!`$C:`$C,MATCH(`$A$r,LivsmedelsDB!`$A:`$A,0)),`"`")))" -Style 3))
        [void]$cells.Add((New-FormulaCell -Row $r -Col 4 -Formula "IF(`$A$r=`"`",`"`",IFERROR(INDEX('Egna livsmedel'!`$E:`$E,MATCH(`$A$r,'Egna livsmedel'!`$A:`$A,0)),IFERROR(INDEX(LivsmedelsDB!`$E:`$E,MATCH(`$A$r,LivsmedelsDB!`$A:`$A,0)),`"`")))" -Style 3))
        [void]$cells.Add((New-FormulaCell -Row $r -Col 5 -Formula "IF(`$A$r=`"`",`"`",IFERROR(INDEX('Egna livsmedel'!`$F:`$F,MATCH(`$A$r,'Egna livsmedel'!`$A:`$A,0)),IFERROR(INDEX(LivsmedelsDB!`$F:`$F,MATCH(`$A$r,LivsmedelsDB!`$A:`$A,0)),`"`")))" -Style 3))
        [void]$cells.Add((New-FormulaCell -Row $r -Col 6 -Formula "IF(`$A$r=`"`",`"`",IFERROR(INDEX('Egna livsmedel'!`$D:`$D,MATCH(`$A$r,'Egna livsmedel'!`$A:`$A,0)),IFERROR(INDEX(LivsmedelsDB!`$D:`$D,MATCH(`$A$r,LivsmedelsDB!`$A:`$A,0)),`"`")))" -Style 3))
        [void]$cells.Add((New-FormulaCell -Row $r -Col 7 -Formula "IF(OR(`$A$r=`"`",`$B$r=`"`"),`"`",`$B$r*C$r/100)" -Style 3))
        [void]$cells.Add((New-FormulaCell -Row $r -Col 8 -Formula "IF(OR(`$A$r=`"`",`$B$r=`"`"),`"`",`$B$r*D$r/100)" -Style 3))
        [void]$cells.Add((New-FormulaCell -Row $r -Col 9 -Formula "IF(OR(`$A$r=`"`",`$B$r=`"`"),`"`",`$B$r*E$r/100)" -Style 3))
        [void]$cells.Add((New-FormulaCell -Row $r -Col 10 -Formula "IF(OR(`$A$r=`"`",`$B$r=`"`"),`"`",`$B$r*F$r/100)" -Style 3))
        [void]$cells.Add((New-TextCell -Row $r -Col 11 -Value ''))
        [void]$mealRowsXml.Add((New-RowXml -Row $r -Cells $cells.ToArray()))
    }

    [void]$mealRowsXml.Add((New-RowXml -Row 59 -Cells @(
        (New-TextCell -Row 59 -Col 1 -Value 'Summering' -Style 5)
    ) -Height 21))
    [void]$mealRowsXml.Add((New-RowXml -Row 60 -Cells @(
        (New-TextCell -Row 60 -Col 1 -Value 'Totalt recept' -Style 2),
        (New-FormulaCell -Row 60 -Col 2 -Formula 'SUM(B8:B57)' -Style 3),
        (New-TextCell -Row 60 -Col 3 -Value 'gram' -Style 4),
        (New-FormulaCell -Row 60 -Col 7 -Formula 'SUM(G8:G57)' -Style 3),
        (New-FormulaCell -Row 60 -Col 8 -Formula 'SUM(H8:H57)' -Style 3),
        (New-FormulaCell -Row 60 -Col 9 -Formula 'SUM(I8:I57)' -Style 3),
        (New-FormulaCell -Row 60 -Col 10 -Formula 'SUM(J8:J57)' -Style 3)
    )))
    [void]$mealRowsXml.Add((New-RowXml -Row 61 -Cells @(
        (New-TextCell -Row 61 -Col 1 -Value 'Per matlåda' -Style 2),
        (New-FormulaCell -Row 61 -Col 2 -Formula 'IF($B$3="","",B60/$B$3)' -Style 3),
        (New-TextCell -Row 61 -Col 3 -Value 'gram' -Style 4),
        (New-FormulaCell -Row 61 -Col 7 -Formula 'IF($B$3="","",G60/$B$3)' -Style 3),
        (New-FormulaCell -Row 61 -Col 8 -Formula 'IF($B$3="","",H60/$B$3)' -Style 3),
        (New-FormulaCell -Row 61 -Col 9 -Formula 'IF($B$3="","",I60/$B$3)' -Style 3),
        (New-FormulaCell -Row 61 -Col 10 -Formula 'IF($B$3="","",J60/$B$3)' -Style 3)
    )))
    [void]$mealRowsXml.Add((New-RowXml -Row 62 -Cells @(
        (New-TextCell -Row 62 -Col 7 -Value 'kcal' -Style 4),
        (New-TextCell -Row 62 -Col 8 -Value 'protein' -Style 4),
        (New-TextCell -Row 62 -Col 9 -Value 'kolh' -Style 4),
        (New-TextCell -Row 62 -Col 10 -Value 'fett' -Style 4)
    )))

    $mealCols = '<cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="2" width="11" customWidth="1"/><col min="3" max="10" width="14" customWidth="1"/><col min="11" max="11" width="28" customWidth="1"/></cols>'
    $dv = @"
<dataValidations count="1">
  <dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="A8:A57">
    <formula1>Livsmedelslista</formula1>
  </dataValidation>
</dataValidations>
"@
    $mealSheet = Build-Sheet -Dimension 'A1:K62' -ColsXml $mealCols -RowsXml $mealRowsXml.ToArray() -ExtraXml $dv -FreezeRow 7

    $instructionRows = @(
        @(1, 'Matlåds-kalkylator', '', '', '', 5),
        @(3, 'Så använder du filen', '', '', '', 2),
        @(4, '1. Gå till bladet Matlåda.', '', '', '', 0),
        @(5, '2. Skriv receptnamn och antal lådor.', '', '', '', 0),
        @(6, '3. Välj livsmedel i dropdownen eller skriv namnet exakt.', '', '', '', 0),
        @(7, '4. Ange gram för varje ingrediens. Resultat räknas totalt och per låda.', '', '', '', 0),
        @(9, 'Viktiga antaganden', '', '', '', 2),
        @(10, 'Alla värden är per 100 g. Välj rå/kokt livsmedel utifrån hur du väger maten.', '', '', '', 0),
        @(11, 'Egna livsmedel prioriteras före LivsmedelsDB om samma namn finns på båda ställen.', '', '', '', 0),
        @(12, 'Fyll whey, Keso Supermini och andra märkesprodukter på bladet Egna livsmedel.', '', '', '', 0),
        @(13, 'Ingen automatisk omräkning görs mellan torr, rå, kokt eller avrunnen vikt.', '', '', '', 0)
    )
    $instructionRowsXml = New-Object System.Collections.Generic.List[string]
    foreach ($line in $instructionRows) {
        [void]$instructionRowsXml.Add((New-RowXml -Row $line[0] -Cells @((New-TextCell -Row $line[0] -Col 1 -Value $line[1] -Style $line[5]))))
    }
    $instructionSheet = Build-Sheet -Dimension 'A1:A13' -ColsXml '<cols><col min="1" max="1" width="105" customWidth="1"/></cols>' -RowsXml $instructionRowsXml.ToArray()

    $styles = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F6F78"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF4F4"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFB8C8C8"/></left><right style="thin"><color rgb="FFB8C8C8"/></right><top style="thin"><color rgb="FFB8C8C8"/></top><bottom style="thin"><color rgb="FFB8C8C8"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>
"@

    $contentTypes = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

    $rootRels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

    $workbook = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="12000"/></bookViews>
  <sheets>
    <sheet name="Matlåda" sheetId="1" r:id="rId1"/>
    <sheet name="LivsmedelsDB" sheetId="2" r:id="rId2"/>
    <sheet name="Egna livsmedel" sheetId="3" r:id="rId3"/>
    <sheet name="Listor" sheetId="4" r:id="rId4"/>
    <sheet name="Instruktion" sheetId="5" r:id="rId5"/>
  </sheets>
  <definedNames>
    <definedName name="Livsmedelslista">Listor!`$A`$2:`$A`$$listLastRow</definedName>
  </definedNames>
  <calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>
"@

    $workbookRels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

    $now = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    $core = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>MatlådsKalkylator</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$now</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$now</dcterms:modified>
</cp:coreProperties>
"@

    $app = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>5</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="5" baseType="lpstr"><vt:lpstr>Matlåda</vt:lpstr><vt:lpstr>LivsmedelsDB</vt:lpstr><vt:lpstr>Egna livsmedel</vt:lpstr><vt:lpstr>Listor</vt:lpstr><vt:lpstr>Instruktion</vt:lpstr></vt:vector></TitlesOfParts>
  <Company></Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0300</AppVersion>
</Properties>
"@

    Write-PackageFile -Root $tmpRoot -RelativePath '[Content_Types].xml' -Content $contentTypes
    Write-PackageFile -Root $tmpRoot -RelativePath '_rels/.rels' -Content $rootRels
    Write-PackageFile -Root $tmpRoot -RelativePath 'xl/workbook.xml' -Content $workbook
    Write-PackageFile -Root $tmpRoot -RelativePath 'xl/_rels/workbook.xml.rels' -Content $workbookRels
    Write-PackageFile -Root $tmpRoot -RelativePath 'xl/styles.xml' -Content $styles
    Write-PackageFile -Root $tmpRoot -RelativePath 'xl/worksheets/sheet1.xml' -Content $mealSheet
    Write-PackageFile -Root $tmpRoot -RelativePath 'xl/worksheets/sheet2.xml' -Content $dbSheet
    Write-PackageFile -Root $tmpRoot -RelativePath 'xl/worksheets/sheet3.xml' -Content $customSheet
    Write-PackageFile -Root $tmpRoot -RelativePath 'xl/worksheets/sheet4.xml' -Content $listSheet
    Write-PackageFile -Root $tmpRoot -RelativePath 'xl/worksheets/sheet5.xml' -Content $instructionSheet
    Write-PackageFile -Root $tmpRoot -RelativePath 'docProps/core.xml' -Content $core
    Write-PackageFile -Root $tmpRoot -RelativePath 'docProps/app.xml' -Content $app

    if (Test-Path $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }
    $outZip = [System.IO.Compression.ZipFile]::Open($outputPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in Get-ChildItem -LiteralPath $tmpRoot -Recurse -File) {
            $entryName = $file.FullName.Substring($tmpRoot.Length).TrimStart('\', '/') -replace '\\', '/'
            $entry = $outZip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
            $entryStream = $entry.Open()
            $fileStream = [System.IO.File]::OpenRead($file.FullName)
            try {
                $fileStream.CopyTo($entryStream)
            }
            finally {
                $fileStream.Dispose()
                $entryStream.Dispose()
            }
        }
    }
    finally {
        $outZip.Dispose()
    }

    $result = [ordered]@{
        Output = $outputPath
        SourceRowsIncludingHeader = $sourceRows.Count
        FoodRows = $foodRows.Count
        ListItems = $listNames.Count
        OriginalLastWriteTime = (Get-Item -LiteralPath $sourcePath).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
    }
    $result | ConvertTo-Json
}
finally {
    if (Test-Path $tmpRoot) {
        Remove-Item -LiteralPath $tmpRoot -Recurse -Force
    }
}
