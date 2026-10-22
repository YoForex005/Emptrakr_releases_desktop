const { desktopCapturer, screen } = require('electron');
const { execFile } = require('child_process');

const PS_CAPTURE_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Capture every display separately, then reduce it before Base64 serialization.
# This preserves display-level metadata and keeps high-resolution displays
# below the Node child-process output limit.
$maxPixels = 8000000
$maxDimension = 3840
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$captures = @()
foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {
    $bounds = $screen.Bounds
    $scale = [Math]::Min(1, [Math]::Min($maxDimension / $bounds.Width, [Math]::Min($maxDimension / $bounds.Height, [Math]::Sqrt($maxPixels / ($bounds.Width * $bounds.Height)))))
    $width = [Math]::Max(1, [Math]::Floor($bounds.Width * $scale))
    $height = [Math]::Max(1, [Math]::Floor($bounds.Height * $scale))
    $source = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $sourceGraphics = [System.Drawing.Graphics]::FromImage($source)
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $ms = New-Object System.IO.MemoryStream
    $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
    try {
        $sourceGraphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
        $graphics.DrawImage($source, 0, 0, $width, $height)
        $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]75)
        $bitmap.Save($ms, $jpegCodec, $encoderParameters)
        $captures += [PSCustomObject]@{
            base64 = [System.Convert]::ToBase64String($ms.ToArray())
            x = $bounds.Left
            y = $bounds.Top
            sourceWidth = $bounds.Width
            sourceHeight = $bounds.Height
        }
    } finally {
        $encoderParameters.Dispose()
        $ms.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
        $sourceGraphics.Dispose()
        $source.Dispose()
    }
}
@($captures) | ConvertTo-Json -Compress
`;

function executePowerShell(script) {
    return new Promise((resolve, reject) => {
        execFile(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-STA', '-Command', script],
            { timeout: 15000, windowsHide: true, maxBuffer: 1024 * 1024 * 32 },
            (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(stderr && String(stderr).trim() ? String(stderr).trim() : err.message));
                    return;
                }
                resolve(String(stdout || '').trim());
            }
        );
    });
}


function boundedImage(image) {
    const { width, height } = image.getSize();
    const scale = Math.min(1, 8000 / width, 8000 / height, Math.sqrt(25000000 / (width * height)));
    if (scale < 1) image = image.resize({ width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), quality: 'good' });
    let bytes = image.toPNG();
    if (bytes.length > 5 * 1024 * 1024) bytes = image.toJPEG(75);
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Screenshot exceeds upload size limit');
    return { bytes, size: image.getSize() };
}

function isBlankCapture(image) {
    // Electron can return a valid, nonempty thumbnail containing only black
    // pixels on particular Windows graphics/remote-desktop configurations.
    // A nonempty image is therefore not sufficient proof that capture worked.
    if (!image || typeof image.toBitmap !== 'function') return false;

    const bitmap = image.toBitmap();
    if (!bitmap?.length) return false;
    const pixelCount = Math.floor(bitmap.length / 4);
    if (!pixelCount) return false;

    const stride = Math.max(1, Math.floor(pixelCount / 4096));
    let sampled = 0;
    let nearBlack = 0;
    let nearWhite = 0;
    let transparent = 0;
    let uniform = 0;
    const reference = [bitmap[0], bitmap[1], bitmap[2]];
    for (let pixel = 0; pixel < pixelCount; pixel += stride) {
        const offset = pixel * 4;
        const blue = bitmap[offset];
        const green = bitmap[offset + 1];
        const red = bitmap[offset + 2];
        if (blue <= 4 && green <= 4 && red <= 4) nearBlack += 1;
        if (blue >= 251 && green >= 251 && red >= 251) nearWhite += 1;
        if (bitmap[offset + 3] <= 4) transparent += 1;
        if (Math.abs(blue - reference[0]) <= 4 && Math.abs(green - reference[1]) <= 4 && Math.abs(red - reference[2]) <= 4) uniform += 1;
        sampled += 1;
    }
    return sampled > 0 && (
        nearBlack / sampled >= 0.995 ||
        nearWhite / sampled >= 0.995 ||
        transparent / sampled >= 0.995 ||
        uniform / sampled >= 0.995
    );
}

async function captureAllMonitorsPng() {
    try {
        const displays = screen.getAllDisplays();
        if (!displays.length) throw new Error('No displays available');
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: {
            width: Math.max(...displays.map(display => Math.round(display.bounds.width * display.scaleFactor))),
            height: Math.max(...displays.map(display => Math.round(display.bounds.height * display.scaleFactor))),
        } });
        return displays.map(display => {
            const source = sources.find(source => String(source.display_id) === String(display.id));
            if (!source || source.thumbnail.isEmpty()) throw new Error('A display could not be captured');
            if (isBlankCapture(source.thumbnail)) throw new Error('A display capture was blank');
            const { bytes, size } = boundedImage(source.thumbnail);
            return { imageBuffer: bytes, display: { ...display.bounds, width: size.width, height: size.height, displayId: String(display.id) } };
        });
    } catch (error) { console.warn('[ScreenshotCapture] Native capture unavailable:', error.message); }
    if (process.platform === 'darwin') {
        const path = require('node:path'), os = require('node:os'), fs = require('node:fs/promises');
        const { nativeImage } = require('electron');
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'emptrakr-capture-'));
        try {
            await fs.chmod(directory, 0o700);
            const displays = screen.getAllDisplays();
            const captures = [];
            for (let index = 0; index < displays.length; index++) {
                const imagePath = path.join(directory, 'display-' + index + '.png');
                await new Promise((resolve, reject) => execFile('screencapture', ['-x', '-C', '-D', String(index + 1), imagePath], { timeout: 15000, windowsHide: true }, error => error ? reject(error) : resolve()));
                await fs.chmod(imagePath, 0o600);
                const image = nativeImage.createFromBuffer(await fs.readFile(imagePath));
                if (isBlankCapture(image)) throw new Error('Screenshot capture was blank');
                const { bytes, size } = boundedImage(image);
                // OS numbering cannot reliably be equated with Electron display IDs.
                captures.push({ imageBuffer: bytes, display: { ...size, x: 0, y: 0, displayId: 'os-display-' + (index + 1) } });
            }
            if (!captures.length) throw new Error('No displays available');
            return captures;
        } finally { await fs.rm(directory, { recursive: true, force: true }); }
    }
    if (process.platform !== 'win32') throw new Error('Native display capture is unavailable');
    const raw = await executePowerShell(PS_CAPTURE_SCRIPT);
    const parsed = JSON.parse(raw);
    const frames = Array.isArray(parsed) ? parsed : [parsed];
    const { nativeImage } = require('electron');
    const displays = screen.getAllDisplays();
    const captures = [];
    for (let index = 0; index < frames.length; index++) {
        const frame = frames[index];
        if (typeof frame?.base64 !== 'string' || !frame.base64) throw new Error('Screenshot payload missing');
        const image = nativeImage.createFromBuffer(Buffer.from(frame.base64, 'base64'));
        if (isBlankCapture(image)) {
            console.warn('[ScreenshotCapture] Windows fallback produced a blank display capture');
            continue;
        }
        const { bytes, size } = boundedImage(image);
        const display = displays.find(candidate => candidate.bounds.x === Number(frame.x) && candidate.bounds.y === Number(frame.y)
            && candidate.bounds.width === Number(frame.sourceWidth) && candidate.bounds.height === Number(frame.sourceHeight));
        captures.push({ imageBuffer: bytes, display: {
            width: size.width, height: size.height, x: Number(frame.x), y: Number(frame.y),
            displayId: display ? String(display.id) : 'os-display-' + (index + 1),
        } });
    }
    if (!captures.length) throw new Error('Screenshot capture was blank');
    return captures;
}
async function captureCurrentMonitorPng() {
    const captures = await captureAllMonitorsPng();
    const primaryId = String(screen.getPrimaryDisplay().id);
    return captures.find(capture => capture.display.displayId === primaryId) || captures[0];
}
module.exports = { captureCurrentMonitorPng, captureAllMonitorsPng, isBlankCapture };
