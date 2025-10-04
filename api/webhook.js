// pages/api/webhook.js
import getRawBody from "raw-body";
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

function verifyShopifyWebhook(req, secret) {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(req.rawBody).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  // get raw body buffer
  try {
    const raw = await getRawBody(req);
    req.rawBody = raw;
  } catch (e) {
    console.error("raw-body error", e);
    return res.status(400).send("Bad request");
  }

  // verify signature (optional but recommended)
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (secret && !verifyShopifyWebhook(req, secret)) {
    console.warn("Webhook signature invalid");
    return res.status(401).send("Invalid signature");
  }

  try {
    const jsonStr = req.rawBody.toString("utf8");
    const payload = JSON.parse(jsonStr);

    console.log("Got order webhook:", payload.id);
    // process line items
    for (const item of payload.line_items || []) {
      if (item.properties) {
        // properties is an array of {name,value} in webhook payload or object?
        // Shopify webhook may return properties as array of {name,value}
        // unify:
        let props = {};
        if (Array.isArray(item.properties)) {
          item.properties.forEach((p) => {
            props[p.name] = p.value;
          });
        } else {
          props = item.properties || {};
        }

        if (props["Custom Image URL"]) {
          console.log("Custom Image URL:", props["Custom Image URL"]);
          // => here you can save to DB, queue print job, call another service, etc.
        }
      }
    }

    res.status(200).send("ok");
  } catch (e) {
    console.error("Webhook handler error", e);
    res.status(500).send("Server error");
  }
}
