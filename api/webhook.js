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

  try {
    const raw = await getRawBody(req);
    req.rawBody = raw;
  } catch (e) {
    console.error("raw-body error", e);
    return res.status(400).send("Bad request");
  }

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (secret && !verifyShopifyWebhook(req, secret)) {
    console.warn("Webhook signature invalid");
    return res.status(401).send("Invalid signature");
  }

  try {
    const jsonStr = req.rawBody.toString("utf8");
    const payload = JSON.parse(jsonStr);

    const orderObject = {
      orderId: payload.id || payload.admin_graphql_api_id || null,
      designUrl: null,
    };

    // process line items
    for (const item of payload.line_items || []) {
      if (item.properties) {
        let props = {};
        if (Array.isArray(item.properties)) {
          item.properties.forEach((p) => {
            props[p.name] = p.value;
          });
        } else {
          props = item.properties || {};
        }

        if (props["Custom Image URL"]) {
          orderObject.designUrl = props["Custom Image URL"];
          break; // stop after first found
        }
      }
    }

    console.log("Got order webhook:", orderObject);

    // return structured response
    return res.status(200).json({
      success: true,
      message: "Order webhook received",
      data: orderObject,
    });
  } catch (e) {
    console.error("Webhook handler error", e);
    return res.status(500).send("Server error");
  }
}
