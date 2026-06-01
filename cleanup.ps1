# Try to rename the directory first
$oldPath = "D:\PDF\dist-electron"
$newPath = "D:\PDF\dist-electron-old"

try {
    # Stop all processes that might be using the directory
    Get-Process | Where-Object { $_.Name -like "*electron*" -or $_.Name -like "*JYY*" -or $_.Name -like "*PDF*" } | Stop-Process -Force -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 2

    # Try to rename the directory
    if (Test-Path $oldPath) {
        Rename-Item -Path $oldPath -NewName "dist-electron-old" -Force -ErrorAction Stop
        Write-Host "Directory renamed successfully"
        Start-Sleep -Seconds 1
        Remove-Item -Path $newPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Old directory removed"
    } else {
        Write-Host "Directory does not exist"
    }
} catch {
    Write-Host "Failed: $_"
}

if (-not (Test-Path $oldPath)) {
    Write-Host "Cleanup completed successfully"
} else {
    Write-Host "Failed to clean up - please close any programs using the dist-electron folder and try again"
}
