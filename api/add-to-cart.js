// api/add-to-cart.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { id, quantity, properties } = req.body;

    // Proxy sang Shopify store frontend API
    const resp = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/cart/add.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id, quantity, properties }] }),
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      console.error("Shopify add-to-cart failed:", text);
      return res.status(resp.status).json({ error: "Shopify add-to-cart failed", data });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
