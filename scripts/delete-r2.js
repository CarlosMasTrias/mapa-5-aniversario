// Deletes ALL objects from the R2 bucket and then exits.
// Run ONCE before rotating the R2 API token:
//
//   node scripts/delete-r2.js
//
// Requires a .env file with R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME set.

require('dotenv').config()
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})
const BUCKET = process.env.R2_BUCKET_NAME

async function main() {
  let total = 0
  let continuationToken

  console.log(`Deleting all objects in bucket "${BUCKET}"...`)

  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
    }))

    const keys = (list.Contents || []).map(o => ({ Key: o.Key }))
    if (!keys.length) break

    await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: keys },
    }))

    total += keys.length
    console.log(`  Deleted ${keys.length} objects (total: ${total})`)
    continuationToken = list.IsTruncated ? list.NextContinuationToken : null
  } while (continuationToken)

  console.log(`Done. ${total} objects deleted.`)
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
