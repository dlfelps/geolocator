Add-Type -AssemblyName System.Drawing

# Create 16x16 icon
$bmp16 = New-Object System.Drawing.Bitmap(16,16)
$g16 = [System.Drawing.Graphics]::FromImage($bmp16)
$g16.Clear([System.Drawing.Color]::FromArgb(59, 130, 246))
$g16.FillEllipse([System.Drawing.Brushes]::White, 2,2,12,12)
$font16 = New-Object System.Drawing.Font("Arial",10,[System.Drawing.FontStyle]::Bold)
$g16.DrawString("G",$font16,[System.Drawing.Brushes]::FromArgb(59, 130, 246),1,0)
$bmp16.Save("icon16.png")
Write-Host "Created icon16.png"

# Create 48x48 icon
$bmp48 = New-Object System.Drawing.Bitmap(48,48)
$g48 = [System.Drawing.Graphics]::FromImage($bmp48)
$g48.Clear([System.Drawing.Color]::FromArgb(59, 130, 246))
$g48.FillEllipse([System.Drawing.Brushes]::White, 6,6,36,36)
$font48 = New-Object System.Drawing.Font("Arial",30,[System.Drawing.FontStyle]::Bold)
$g48.DrawString("G",$font48,[System.Drawing.Brushes]::FromArgb(59, 130, 246),6,2)
$bmp48.Save("icon48.png")
Write-Host "Created icon48.png"

# Create 128x128 icon
$bmp128 = New-Object System.Drawing.Bitmap(128,128)
$g128 = [System.Drawing.Graphics]::FromImage($bmp128)
$g128.Clear([System.Drawing.Color]::FromArgb(59, 130, 246))
$g128.FillEllipse([System.Drawing.Brushes]::White, 16,16,96,96)
$font128 = New-Object System.Drawing.Font("Arial",80,[System.Drawing.FontStyle]::Bold)
$g128.DrawString("G",$font128,[System.Drawing.Brushes]::FromArgb(59, 130, 246),16,6)
$bmp128.Save("icon128.png")
Write-Host "Created icon128.png"

Write-Host "All icons created successfully!"
