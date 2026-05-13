import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer setup for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

/**
 * Ad Variation Builder API
 * Handles batch generation of ad variations.
 */
app.post('/api/generate-variation', upload.fields([
  { name: 'sampleAd', maxCount: 1 },
  { name: 'productImage', maxCount: 1 }
]), async (req: any, res) => {
  try {
    const { prompt } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.sampleAd) {
      return res.status(400).json({ error: 'Missing sample ad image' });
    }

    const sampleAd = files.sampleAd[0];
    const productImage = files.productImage ? files.productImage[0] : null;

    if (prompt && productImage) {
      return res.status(400).json({ error: 'Cannot use both prompt and product image. Choose one.' });
    }

    if (!prompt && !productImage) {
      return res.status(400).json({ error: 'Missing product description or image' });
    }

    const model = 'gemini-2.5-flash-image';
    const contents: any[] = [
      {
        inlineData: {
          data: sampleAd.buffer.toString('base64'),
          mimeType: sampleAd.mimetype,
        }
      }
    ];

    let instruction = '';
    if (prompt) {
      contents.push({ text: `Target Product: ${prompt}` });
      instruction = `
        Analyze the first image (Sample Ad).
        Identify the main product being advertised.
        Replace that product with a new one based on this description: "${prompt}".
        
        CRITICAL GUIDELINES:
        1. Maintain EXACTLY the same background, layout, fonts, text, and overall composition.
        2. The new product must be clean, with professional lighting, shadows, and reflections that match the original ad's environment.
        3. Completely cover the original product location. Do not leave any ghosts or overlapping parts of the old product.
        4. The aspect ratio and resolution must remain identical to the sample ad.
        5. The output should be the final advertisement poster.
      `;
    } else if (productImage) {
      contents.push({
        inlineData: {
          data: productImage.buffer.toString('base64'),
          mimeType: productImage.mimetype,
        }
      });
      instruction = `
        Analyze the first image (Sample Ad) and the second image (New Product).
        Replace the main product in the Sample Ad with the product shown in the New Product image.
        
        CRITICAL GUIDELINES:
        1. Maintain EXACTLY the same background, layout, fonts, text, and overall composition from the Sample Ad.
        2. The product from the second image should be placed naturally into the first image.
        3. Apply professional lighting, shadows, and reflections to the new product to match the environment of the first image.
        4. Handle background removal/masking for the new product if it has its own background.
        5. Completely cover the original product location. Do not leave any ghosts or overlapping parts of the old product.
        6. The aspect ratio and resolution must remain identical to the sample ad.
        7. The output should be the final advertisement poster.
      `;
    }

    contents.push({ text: instruction });

    const response = await ai.models.generateContent({
      model,
      contents: { parts: contents },
    });

    let resultImageBase64 = null;
    let resultText = '';

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        resultImageBase64 = part.inlineData.data;
      } else if (part.text) {
        resultText += part.text;
      }
    }

    if (!resultImageBase64) {
      return res.status(500).json({ error: 'Model failed to generate an image', details: resultText });
    }

    res.json({
      image: resultImageBase64,
      mimeType: 'image/png', // Gemini usually returns PNG
      text: resultText
    });

  } catch (error: any) {
    console.error('Error generating variation:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
