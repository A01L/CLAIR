import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * prompt: string
 * aiKey: string (ключ владельца из БД/очереди)
 */
export async function geminiGenerateJson({ prompt, aiKey }) {
  const key = typeof aiKey === "string" ? aiKey.trim() : "";

  if (!key) {
    throw new Error("aiKey is required (owner Google AI Studio key)");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent(prompt);
  return result.response.text();
}
