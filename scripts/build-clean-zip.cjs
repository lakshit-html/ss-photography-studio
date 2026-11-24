const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createZip() {
  console.log('[Zip Packer] Starting clean project packaging...');
  const zip = new JSZip();
  const rootDir = path.resolve(__dirname, '..');
  const outputFile = path.join(rootDir, 'SS-Photography-Platform.zip');

  const skipDirs = new Set([
    'node_modules',
    '.next',
    '.git',
    'storage',
    'tether_inbox',
  ]);

  const skipFiles = new Set([
    'SS-Photography-Platform.zip',
    '.env',
    'dev.db-journal',
  ]);

  let fileCount = 0;

  function addDirectory(currentDir, zipFolder) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        if (relPath.startsWith('public' + path.sep + 'uploads')) {
          // Keep empty directory placeholder
          zipFolder.folder(entry.name);
          continue;
        }
        const subFolder = zipFolder.folder(entry.name);
        addDirectory(fullPath, subFolder);
      } else if (entry.isFile()) {
        if (skipFiles.has(entry.name)) continue;
        const fileData = fs.readFileSync(fullPath);
        zipFolder.file(entry.name, fileData);
        fileCount++;
      }
    }
  }

  addDirectory(rootDir, zip);

  console.log(`[Zip Packer] Collected ${fileCount} source files and models. Generating compressed archive...`);
  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  fs.writeFileSync(outputFile, content);
  const sizeMB = (content.length / (1024 * 1024)).toFixed(2);
  console.log(`[Zip Packer] Successfully generated ${outputFile} (${sizeMB} MB)`);
}

createZip().catch((err) => {
  console.error('[Zip Packer] Error:', err);
  process.exit(1);
});
