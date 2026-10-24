Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile("public\og-image.jpg")
$bmp = New-Object System.Drawing.Bitmap($src)

# Save as clean PNG with 90% quality / standard color space
$bmp.Save("public\og-image.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)

$src.Dispose()
$bmp.Dispose()
