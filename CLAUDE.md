# Shopify 3D Product Customizer

Serverless 3D product customizer for Shopify. Customers upload images/designs and apply them as textures on 3D product models (mugs, handbags, thermos) with real-time preview.

## Tech Stack
- **Frontend**: Three.js, Vite, Vanilla JS, Canvas API
- **Backend**: Vercel Functions, Cloudinary, Formidable
- **No frameworks** (React/Vue) or TypeScript

## Key Files
- `/src/main.js` - Core 3D logic + layer management
- `/api/upload.js` - Cloudinary upload handler
- `/api/add-to-cart.js` - Shopify cart proxy
- `/public/*.glb` - 3D models

## Commands
```bash
npm run dev      # Dev server
npm run build    # Production build
```
