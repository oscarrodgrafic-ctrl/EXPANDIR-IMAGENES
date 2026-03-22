import { GoogleGenAI } from "@google/genai";

export async function expandImage(
  base64Image: string,
  aspectRatio: string,
  additionalPrompt: string
): Promise<string | null> {
  // Use process.env.API_KEY if available (from selection dialog), otherwise fallback to process.env.GEMINI_API_KEY
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    TASK: Image Outpainting / Expansion.
    
    CONTEXT: The provided image is a composition where an original photo is placed on a canvas. 
    The empty areas (background) need to be filled by expanding the environment of the photo to fill the entire canvas.
    
    STRICT INSTRUCTIONS:
    1. IDENTIFY the original photo within the canvas.
    2. CONSERVE the original photo exactly as it is. Do not alter, redraw, or modify any existing elements.
    3. FILL the empty/background areas by continuing the environment naturally.
    4. MAINTAIN exactly the same illumination, color palette, perspective, and artistic style.
    5. CRITICAL: The transition between the original photo and the new area must be PERFECTLY SEAMLESS and INVISIBLE. 
    6. There should be NO visible borders, edges, or "patch" effect around the original photo.
    ${additionalPrompt ? `7. ADDITIONAL USER REQUEST: ${additionalPrompt}` : ""}
    
    Output only the resulting expanded image.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(",")[1],
              mimeType: "image/png",
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: "1K",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error expanding image:", error);
    throw error;
  }
}
