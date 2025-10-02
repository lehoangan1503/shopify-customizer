// server.js (Express + multer)
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file");
  // move file, or push to S3/Cloudinary
  const newPath = path.join(__dirname, "uploads", Date.now() + "-" + req.file.originalname);
  fs.renameSync(req.file.path, newPath);
  // In production push newPath to S3 and return public URL
  const publicUrl = `https://your-cdn.com/uploads/${path.basename(newPath)}`;
  return res.json({ url: publicUrl });
});

app.post("/webhooks/orders/create", express.json({ limit: "1mb" }), (req, res) => {
  // Verify Shopify HMAC if needed (use raw body method)
  console.log("Order webhook", req.body.id);
  res.send("ok");
});

app.listen(3000, () => console.log("Server start 3000"));
