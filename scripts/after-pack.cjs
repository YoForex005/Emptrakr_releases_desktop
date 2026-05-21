const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const projectDir = context.packager.projectDir;
  const exePath = path.join(context.appOutDir, 'EmpTrakr.exe');
  const iconPath = path.join(projectDir, 'build', 'icon.ico');
  const rcEditPath = path.join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');
  const version = context.packager.appInfo.version;

  for (const filePath of [exePath, iconPath, rcEditPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`[afterPack] Missing required file: ${filePath}`);
    }
  }

  execFileSync(rcEditPath, [
    exePath,
    '--set-icon',
    iconPath,
    '--set-version-string',
    'FileDescription',
    'EmpTrakr',
    '--set-version-string',
    'ProductName',
    'EmpTrakr',
    '--set-version-string',
    'CompanyName',
    'EmpTrakr',
    '--set-version-string',
    'OriginalFilename',
    'EmpTrakr.exe',
    '--set-file-version',
    version,
    '--set-product-version',
    version,
  ], { stdio: 'inherit' });

  console.log(`[afterPack] Stamped Windows icon on ${exePath}`);
};
