import cloudinary from "cloudinary";
import formidable from "formidable";

// Vercel config - disable body parser for multipart form data
// Note: Vercel has a 4.5MB request body limit for serverless functions
// For larger files, use client-side direct upload to Cloudinary
export const config = {
  api: { bodyParser: false },
};

// Cloudinary setup
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * @typedef {Object} FormidableFile
 * @property {string} filepath - Path to the temporary file
 * @property {string} originalFilename - Original filename
 * @property {string} mimetype - MIME type
 * @property {number} size - File size in bytes
 */

/**
 * Upload handler for Cloudinary
 * Accepts multipart form data with a 'file' field
 * Returns JSON with the Cloudinary secure URL
 *
 * Note: This endpoint is subject to Vercel's 4.5MB payload limit.
 * For larger files, configure client-side direct upload using
 * VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET
 *
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check Cloudinary configuration
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("[Upload] Missing Cloudinary configuration");
    return res.status(500).json({ error: "Server configuration error: Cloudinary not configured" });
  }

  // Configure formidable with size limits
  // maxFileSize is 4MB to stay safely under Vercel's 4.5MB limit
  const form = formidable({
    multiples: false,
    maxFileSize: 4 * 1024 * 1024, // 4MB limit
  });

  // Wrap form.parse in a Promise for cleaner async/await handling
  /** @type {{ fields: formidable.Fields, files: formidable.Files }} */
  let parsed;

  try {
    parsed = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          // Check for specific error types
          if (err.code === "LIMIT_FILE_SIZE" || err.message?.includes("maxFileSize")) {
            reject(new Error("FILE_TOO_LARGE"));
          } else {
            reject(err);
          }
        } else {
          resolve({ fields, files });
        }
      });
    });
  } catch (parseErr) {
    if (parseErr.message === "FILE_TOO_LARGE") {
      return res.status(413).json({
        error: "File too large",
        message: "File exceeds 4MB limit. Please use client-side compression or direct Cloudinary upload.",
        hint: "Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET for direct uploads"
      });
    }
    console.error("[Upload] Form parse error:", parseErr);
    return res.status(400).json({ error: "Error parsing form data" });
  }

  // Extract file from parsed form
  /** @type {FormidableFile | undefined} */
  const file = parsed.files.file?.[0] || parsed.files.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({ error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" });
  }

  try {
    // Upload to Cloudinary
    const result = await cloudinary.v2.uploader.upload(file.filepath, {
      folder: "shopify-customizer",
      resource_type: "image",
      // Optimize delivery
      transformation: [
        { quality: "auto:best", fetch_format: "auto" }
      ]
    });

    console.log("[Upload] Success:", result.public_id);

    return res.status(200).json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height
    });
  } catch (uploadErr) {
    console.error("[Upload] Cloudinary error:", uploadErr);
    return res.status(500).json({
      error: "Upload to Cloudinary failed",
      message: uploadErr.message || "Unknown error"
    });
  }
}
