const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const zip = new JSZip();
const rootDir = process.cwd();

const includeDirs = ['src', 'prisma', 'uploader', 'public', 'models', 'storage', 'tests'];
const includeFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tailwind.config.js',
  'postcss.config.js',
  'next.config.mjs',
  'next-env.d.ts',
  'README.md',
  '.env.example'
];

function addFileToZip(filePath, relativePath) {
  const content = fs.readFileSync(filePath);
  zip.file(relativePath.replace(/\\/g, '/'), content);
}

function addDirectoryToZip(dirPath, relativeDir = '') {
  if (!fs.existsSync(dirPath)) return;
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    if (item === 'node_modules' || item === '.next' || item === '.git' || item.endsWith('.zip')) continue;
    const fullPath = path.join(dirPath, item);
    const relPath = path.join(relativeDir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      addDirectoryToZip(fullPath, relPath);
    } else {
      addFileToZip(fullPath, relPath);
    }
  }
}

for (const dir of includeDirs) {
  const fullDir = path.join(rootDir, dir);
  if (fs.existsSync(fullDir)) {
    addDirectoryToZip(fullDir, dir);
  }
}

for (const file of includeFiles) {
  const fullFile = path.join(rootDir, file);
  if (fs.existsSync(fullFile)) {
    addFileToZip(fullFile, file);
  }
}

console.log('Generating ZIP archive...');
zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  .then(buffer => {
    const destPath = path.join(rootDir, 'SS-Photography-Platform.zip');
    fs.writeFileSync(destPath, buffer);
    console.log(`ZIP created successfully at ${destPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    try {
      const desktopPath = 'C:/Users/Suresh/Desktop/SS-Photography-Platform.zip';
      fs.writeFileSync(desktopPath, buffer);
      console.log(`Desktop copy updated at ${desktopPath}`);
    } catch (e) {
      console.log('Could not write desktop copy directly:', e.message);
    }
  })
  .catch(err => {
    console.error('Error generating ZIP:', err);
    process.exit(1);
  });
