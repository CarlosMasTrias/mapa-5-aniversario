#!/usr/bin/env node
// Convierte archivos .heic/.HEIC a WebP (formato óptimo para web).
// Uso: node scripts/convert-heic.js [directorio]
// Si no se indica directorio, usa el directorio actual.

const fs   = require('fs');
const path = require('path');

async function main() {
  const heicConvert = (await import('heic-convert')).default;
  const sharp = require('sharp');

  const targetDir = path.resolve(process.argv[2] || process.cwd());

  if (!fs.existsSync(targetDir)) {
    console.error(`Directorio no encontrado: ${targetDir}`);
    process.exit(1);
  }

  console.log(`Buscando archivos .heic en: ${targetDir}\n`);

  const files = findHeicFiles(targetDir);

  if (!files.length) {
    console.log('No se encontraron archivos .heic.');
    return;
  }

  console.log(`Encontrados ${files.length} archivo(s). Convirtiendo a WebP...\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath  = path.relative(targetDir, filePath);
    const outPath  = filePath.replace(/\.heic$/i, '.webp');

    process.stdout.write(`[${i + 1}/${files.length}] ${relPath} → `);

    try {
      const inputBuffer = fs.readFileSync(filePath);

      const jpegBuffer = await heicConvert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 1,
      });

      await sharp(Buffer.from(jpegBuffer))
        .webp({ quality: 82 })
        .toFile(outPath);

      console.log(`✓ ${path.basename(outPath)}`);
      ok++;
    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nFinalizado: ${ok} convertidos, ${fail} errores.`);
  if (ok > 0) {
    console.log('Los .heic originales se han mantenido. Bórralos manualmente si no los necesitas.');
  }
}

function findHeicFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...findHeicFiles(fullPath));
    } else if (entry.isFile() && /\.heic$/i.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
