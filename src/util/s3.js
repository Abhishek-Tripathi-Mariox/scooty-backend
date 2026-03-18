const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

const Bucket = process.env.BUCKET;
const Region = process.env.REGION;
const AccessKey = process.env.ACCESSKEY;
const SecretKey = process.env.SECRETACCESSKEY;

// Allowed MIME types for upload
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const config = {
  region: Region,
  credentials: {
    accessKeyId: AccessKey,
    secretAccessKey: SecretKey,
  },
};

const s3Client = new S3Client(config);

async function uploadFileToAws(file) {
  // If multiple files: file is array
  if (Array.isArray(file)) {
    const urls = [];

    for (const f of file) {
      const url = await uploadSingleFile(f);
      urls.push(url);
    }

    return { images: urls };
  }

  // If single file
  const url = await uploadSingleFile(file);
  return { images: [url] }; // always return array
}

// Helper function to upload one file
async function uploadSingleFile(file) {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    );
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`File type '${file.mimetype}' is not allowed`);
  }

  // Sanitize filename: use UUID + original extension only
  const ext = path
    .extname(file.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "");
  const safeExt = ext || ".bin";
  const fileName = `${uuidv4()}${safeExt}`;

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket,
      Key: fileName,
      Body: file.data,
      ContentType: file.mimetype,
    },
    queueSize: 3,
  });

  const data = await upload.done();
  return data.Location;
}

module.exports = {
  uploadFileToAws,
};
