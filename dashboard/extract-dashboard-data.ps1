Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourcePath = 'C:\Users\Fredrik\Downloads\MatladsKalkylator.xlsx'
$scriptRoot = if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) { (Get-Location).Path } else { $PSScriptRoot }
$outputPath = Join-Path $scriptRoot 'data.js'

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipEntryText {
    param(
        [System.IO.Compression.ZipArchive] $Zip,
        [string] $Name
    )
    $entry = $Zip.GetEntry($Name)
    if ($null -eq $entry) { return $null }
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    try { return $reader.ReadToEnd() }
    finally {
        $reader.Dispose()
        $stream.Dispose()
    }
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

function Convert-ToNumber {
    param($Value)
    if ($null -eq $Value -or [string]$Value -eq '') { return $null }
    $text = ([string]$Value).Replace(',', '.')
    $number = 0.0
    if ([double]::TryParse($text, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
        return [math]::Round($number, 4)
    }
    return $null
}

function Get-CellText {
    param(
        [System.Xml.XmlElement] $Cell,
        [string[]] $SharedStrings
    )
    $type = $Cell.GetAttribute('t')
    if ($type -eq 'inlineStr') { return $Cell.InnerText }
    $valueNode = $Cell.GetElementsByTagName('v') | Select-Object -First 1
    if ($null -eq $valueNode) { return '' }
    $raw = $valueNode.InnerText
    if ($type -eq 's' -and $raw -ne '') { return $SharedStrings[[int]$raw] }
    return $raw
}

function Read-Workbook {
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

        $sheets = @{}
        foreach ($sheet in $workbookXml.DocumentElement.GetElementsByTagName('sheet')) {
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
                $values = @{}
                foreach ($cell in $row.GetElementsByTagName('c')) {
                    $values[(Get-ColIndex $cell.r)] = Get-CellText -Cell $cell -SharedStrings $shared.ToArray()
                }
                [void]$rows.Add([pscustomobject]@{
                    Number = [int]$row.r
                    Values = $values
                })
            }
            $sheets[$sheet.name] = $rows
        }
        return $sheets
    }
    finally {
        $zip.Dispose()
    }
}

function Get-Cell {
    param(
        [object] $Row,
        [int] $Index
    )
    if ($Row.Values.ContainsKey($Index)) { return $Row.Values[$Index] }
    return ''
}

function New-Food {
    param(
        [object] $Row,
        [string] $Source
    )
    $name = Get-Cell -Row $Row -Index 1
    if ([string]::IsNullOrWhiteSpace($name) -or $name -eq 'Livsmedelsnamn') { return $null }
    return [pscustomobject]([ordered]@{
        id = ($Source + ':' + $name).ToLowerInvariant()
        name = $name
        group = Get-Cell -Row $Row -Index 2
        kcal = Convert-ToNumber (Get-Cell -Row $Row -Index 3)
        fat = Convert-ToNumber (Get-Cell -Row $Row -Index 4)
        protein = Convert-ToNumber (Get-Cell -Row $Row -Index 5)
        carbs = Convert-ToNumber (Get-Cell -Row $Row -Index 6)
        fiber = Convert-ToNumber (Get-Cell -Row $Row -Index 7)
        source = $Source
    })
}

function Convert-ToSlug {
    param([string] $Value)
    $slug = $Value.ToLowerInvariant()
    $slug = $slug -replace '[^a-z0-9åäö]+', '-'
    $slug = $slug.Trim('-')
    if ($slug -eq '') { return [guid]::NewGuid().ToString('N') }
    return $slug
}

function New-Ingredient {
    param([object] $Row)
    $name = Get-Cell -Row $Row -Index 1
    $grams = Convert-ToNumber (Get-Cell -Row $Row -Index 2)
    if ([string]::IsNullOrWhiteSpace($name) -or $null -eq $grams) { return $null }
    return [pscustomobject]([ordered]@{
        name = $name
        grams = $grams
        kcal100 = Convert-ToNumber (Get-Cell -Row $Row -Index 3)
        protein100 = Convert-ToNumber (Get-Cell -Row $Row -Index 4)
        carbs100 = Convert-ToNumber (Get-Cell -Row $Row -Index 5)
        fat100 = Convert-ToNumber (Get-Cell -Row $Row -Index 6)
        comment = Get-Cell -Row $Row -Index 11
    })
}

function Read-Recipes {
    param([object[]] $Rows)

    $recipes = New-Object System.Collections.Generic.List[object]
    $current = $null
    $insideIngredients = $false
    foreach ($row in $Rows) {
        $a = Get-Cell -Row $row -Index 1
        if ([string]::IsNullOrWhiteSpace($a)) { continue }
        if ($a -eq 'Recept' -or $a -eq 'Livsmedel') {
            if ($a -eq 'Livsmedel') { $insideIngredients = $true }
            continue
        }
        if ($a -eq 'Summering') {
            if ($null -ne $current) {
                [void]$recipes.Add($current)
                $current = $null
            }
            $insideIngredients = $false
            continue
        }

        if (-not $insideIngredients) {
            $current = [pscustomobject]([ordered]@{
                id = Convert-ToSlug $a
                name = $a
                defaultServings = 1
                ingredients = New-Object System.Collections.Generic.List[object]
            })
            continue
        }

        if ($null -ne $current) {
            $ingredient = New-Ingredient -Row $row
            if ($null -ne $ingredient) {
                [void]$current.ingredients.Add($ingredient)
            }
        }
    }

    return $recipes
}

if (-not (Test-Path $sourcePath)) {
    throw "Missing source workbook: $sourcePath"
}

$sheets = Read-Workbook -Path $sourcePath
$foodsByName = @{}
$foodOrder = New-Object System.Collections.Generic.List[string]
foreach ($row in $sheets['LivsmedelsDB']) {
    $food = New-Food -Row $row -Source 'LivsmedelsDB'
    if ($null -ne $food -and -not $foodsByName.ContainsKey($food.name)) {
        $foodsByName[$food.name] = $food
        [void]$foodOrder.Add($food.name)
    }
}
foreach ($row in $sheets['Egna livsmedel']) {
    $food = New-Food -Row $row -Source 'Eget'
    if ($null -ne $food) {
        if (-not $foodsByName.ContainsKey($food.name)) {
            [void]$foodOrder.Add($food.name)
        }
        $foodsByName[$food.name] = $food
    }
}

$recipes = @(Read-Recipes -Rows $sheets['Recept'])
$plan = New-Object System.Collections.Generic.List[object]
foreach ($recipe in $recipes) {
    [void]$plan.Add([pscustomobject]([ordered]@{
        recipeId = $recipe.id
        servings = 5
    }))
}

$foodArray = New-Object System.Collections.Generic.List[object]
foreach ($foodName in $foodOrder) {
    [void]$foodArray.Add($foodsByName[$foodName])
}

$targets = New-Object psobject
$trainingTarget = New-Object psobject
$trainingTarget | Add-Member -MemberType NoteProperty -Name kcal -Value 2500
$trainingTarget | Add-Member -MemberType NoteProperty -Name protein -Value 190
$trainingTarget | Add-Member -MemberType NoteProperty -Name carbs -Value 290
$trainingTarget | Add-Member -MemberType NoteProperty -Name fat -Value 56
$restTarget = New-Object psobject
$restTarget | Add-Member -MemberType NoteProperty -Name kcal -Value 2250
$restTarget | Add-Member -MemberType NoteProperty -Name protein -Value 190
$restTarget | Add-Member -MemberType NoteProperty -Name carbs -Value 225
$restTarget | Add-Member -MemberType NoteProperty -Name fat -Value 64
$targets | Add-Member -MemberType NoteProperty -Name training -Value $trainingTarget
$targets | Add-Member -MemberType NoteProperty -Name rest -Value $restTarget

$payload = New-Object psobject
$payload | Add-Member -MemberType NoteProperty -Name generatedAt -Value ((Get-Date).ToString('s'))
$payload | Add-Member -MemberType NoteProperty -Name sourceFile -Value $sourcePath
$payload | Add-Member -MemberType NoteProperty -Name sourceLastWriteTime -Value ((Get-Item -LiteralPath $sourcePath).LastWriteTime.ToString('s'))
$payload | Add-Member -MemberType NoteProperty -Name targets -Value $targets
$payload | Add-Member -MemberType NoteProperty -Name foods -Value ($foodArray.ToArray())
$payload | Add-Member -MemberType NoteProperty -Name recipes -Value $recipes
$payload | Add-Member -MemberType NoteProperty -Name cookPlan -Value ($plan.ToArray())

$json = $payload | ConvertTo-Json -Depth 12
$content = "window.MATDASH_DATA = $json;`n"
[System.IO.File]::WriteAllText($outputPath, $content, [System.Text.Encoding]::UTF8)

[pscustomobject]([ordered]@{
    Output = $outputPath
    Foods = $foodsByName.Count
    Recipes = $recipes.Count
    SourceLastWriteTime = (Get-Item -LiteralPath $sourcePath).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
}) | ConvertTo-Json
