Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5173
$address = [System.Net.IPAddress]::Parse('127.0.0.1')

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'
    '.js' = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.png' = 'image/png'
}

function Get-SafePath {
    param([string] $UrlPath)
    $pathOnly = ($UrlPath -split '\?')[0]
    $relative = [System.Uri]::UnescapeDataString($pathOnly.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relative)) {
        $relative = 'index.html'
    }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    $rootFull = [System.IO.Path]::GetFullPath($root)
    if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }
    return $full
}

function Write-Response {
    param(
        [System.Net.Sockets.NetworkStream] $Stream,
        [int] $StatusCode,
        [string] $StatusText,
        [string] $ContentType,
        [byte[]] $Body
    )
    $header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
}

$listener = [System.Net.Sockets.TcpListener]::new($address, $port)
$listener.Start()

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()
        $buffer = New-Object byte[] 4096
        $count = $stream.Read($buffer, 0, $buffer.Length)
        if ($count -le 0) { continue }

        $requestText = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $count)
        $firstLine = ($requestText -split "`r?`n")[0]
        $parts = $firstLine -split ' '
        if ($parts.Count -lt 2) {
            $body = [System.Text.Encoding]::UTF8.GetBytes('Bad request')
            Write-Response -Stream $stream -StatusCode 400 -StatusText 'Bad Request' -ContentType 'text/plain; charset=utf-8' -Body $body
            continue
        }

        $filePath = Get-SafePath $parts[1]
        if ($null -eq $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
            Write-Response -Stream $stream -StatusCode 404 -StatusText 'Not Found' -ContentType 'text/plain; charset=utf-8' -Body $body
            continue
        }

        $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
        $bodyBytes = [System.IO.File]::ReadAllBytes($filePath)
        Write-Response -Stream $stream -StatusCode 200 -StatusText 'OK' -ContentType $contentType -Body $bodyBytes
    }
    catch {
        try {
            $body = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
            Write-Response -Stream $stream -StatusCode 500 -StatusText 'Internal Server Error' -ContentType 'text/plain; charset=utf-8' -Body $body
        }
        catch {}
    }
    finally {
        $client.Close()
    }
}
