// pages/api/upload.js
import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error", err);
      return res.status(500).json({ error: "Form parse error" });
    }

    const file = files.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    try {
      // on vercel, file.path exists as temp file
      const pathToFile = file.filepath || file.path || file.file;
      const result = await cloudinary.uploader.upload(pathToFile, {
        folder: "shopify_custom_designs",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      });

      // remove local temp file if exists
      try {
        fs.unlinkSync(pathToFile);
      } catch (e) {}

      return res.json({ url: result.secure_url });
    } catch (e) {
      console.error("Cloudinary upload error", e);
      return res.status(500).json({ error: e.message || "Upload failed" });
    }
  });
}
