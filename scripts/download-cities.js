// Downloads GeoNames cities15000.txt and generates src/data/countryCities.generated.json
// with all cities grouped by ISO country code, sorted by population desc.
//
// Usage: node scripts/download-cities.js
// Output: src/data/countryCities.generated.json  (import it instead of the static JS if you want full coverage)
//
// GeoNames licence: Creative Commons Attribution 4.0 — https://www.geonames.org/about.html

const fs = require('fs')
const path = require('path')
const https = require('https')
const zlib = require('zlib')

const GEONAMES_URL = 'https://download.geonames.org/export/dump/cities15000.zip'
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'countryCities.generated.json')
const MAX_PER_COUNTRY = 100

// GeoNames TSV column indices (cities15000.txt)
const COL_NAME        = 1   // UTF-8 name
const COL_NAME_ASCII  = 2   // ASCII name
const COL_ALTERNATES  = 3   // comma-separated alternate names
const COL_COUNTRY     = 8   // ISO country code
const COL_POPULATION  = 14  // population

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function unzip(buf) {
  return new Promise((resolve, reject) => {
    // Minimal ZIP parser: find the first local file entry and decompress it
    // Local file header signature: 0x04034b50
    let offset = 0
    while (offset < buf.length - 30) {
      if (buf.readUInt32LE(offset) === 0x04034b50) {
        const compression = buf.readUInt16LE(offset + 8)
        const compressedSize = buf.readUInt32LE(offset + 18)
        const fileNameLen = buf.readUInt16LE(offset + 26)
        const extraLen = buf.readUInt16LE(offset + 28)
        const dataOffset = offset + 30 + fileNameLen + extraLen
        const compressed = buf.slice(dataOffset, dataOffset + compressedSize)
        if (compression === 0) return resolve(compressed)        // stored
        if (compression === 8) return resolve(zlib.inflateRawSync(compressed)) // deflated
        return reject(new Error(`Unsupported compression: ${compression}`))
      }
      offset++
    }
    reject(new Error('No local file entry found in ZIP'))
  })
}

async function main() {
  console.log('Downloading GeoNames cities15000.zip (~10MB)...')
  const zipBuf = await download(GEONAMES_URL)
  console.log(`Downloaded ${(zipBuf.length / 1e6).toFixed(1)} MB`)

  console.log('Unzipping...')
  const txtBuf = await unzip(zipBuf)
  const lines = txtBuf.toString('utf8').split('\n')
  console.log(`Parsing ${lines.length} entries...`)

  const byCountry = {}

  for (const line of lines) {
    if (!line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 15) continue

    const name    = cols[COL_NAME]
    const country = cols[COL_COUNTRY]
    const pop     = parseInt(cols[COL_POPULATION], 10) || 0

    if (!country || !name) continue

    if (!byCountry[country]) byCountry[country] = []
    byCountry[country].push({ name, pop })
  }

  // Sort each country by population desc, take top N, keep only names
  const result = {}
  for (const [code, cities] of Object.entries(byCountry)) {
    result[code] = cities
      .sort((a, b) => b.pop - a.pop)
      .slice(0, MAX_PER_COUNTRY)
      .map(c => c.name)
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8')
  const total = Object.values(result).reduce((s, a) => s + a.length, 0)
  console.log(`✓ ${Object.keys(result).length} countries, ${total} cities → ${OUTPUT_PATH}`)
  console.log('\nTo use it, replace the import in CountryPage.vue:')
  console.log("  import COUNTRY_CITIES from '@/data/countryCities.generated.json'")
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
