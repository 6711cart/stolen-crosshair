const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'release', 'win-unpacked', 'Stolen Crosshair.exe');

if (!fs.existsSync(appPath)) {
  console.error('Build the Windows app first with "npm.cmd run build".');
  process.exitCode = 1;
} else {
  const app = spawn(appPath, [], { detached: true, stdio: 'ignore' });
  app.once('error', (error) => {
    console.error('Could not launch Stolen Crosshair:', error.message);
    process.exitCode = 1;
  });
  app.unref();
}
