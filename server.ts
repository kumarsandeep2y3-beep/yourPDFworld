import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Server-side Gemini client for accurate OCR transcription
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// OCR Endpoint: analyzes scanned document pages using Gemini 3.8 Flash
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!process.env.GEMINI_API_KEY || !ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY not configured on server',
        fallbackAvailable: true,
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        },
        {
          text: `You are an expert Optical Character Recognition (OCR) engine.
Transcribe all text from this scanned document page with 100% precision.
Preserve the layout hierarchy, formatting, headings, paragraphs, lists, and tables as closely as possible.
Return the response strictly in JSON format matching this schema:
{
  "fullText": "Full text in clean markdown format preserving layout, headings, and lists",
  "blocks": [
    {
      "type": "heading" | "paragraph" | "list_item" | "table_row",
      "text": "The extracted text line or block",
      "fontSize": 18 | 14 | 10,
      "bold": true | false
    }
  ]
}`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('OCR Endpoint Error:', error);
    return res.status(500).json({
      error: error.message || 'OCR processing failed',
      fallbackAvailable: true,
    });
  }
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`JustPDF server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
