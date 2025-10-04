import cloudinary from "cloudinary";
import formidable from "formidable";
import fs from "fs";

// Vercel config
export const config = {
  api: { bodyParser: false },
};

// Cloudinary setup
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "Error parsing form" });

    const file = files.file?.[0] || files.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const result = await cloudinary.v2.uploader.upload(file.filepath, {
        folder: "shopify-customizer",
        resource_type: "image",
      });

      return res.status(200).json({ url: result.secure_url });
    } catch (uploadErr) {
      console.error(uploadErr);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
}
