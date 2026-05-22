import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: AI Advisor Chat
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Invalid messages format" });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
        res.status(400).json({
          error: "API 密钥缺失。请在 Secrets 面板中设置您的 GEMINI_API_KEY 环境变量。"
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `
你是一位极其专业的军事弹道物理学家和坦克/军舰历史装甲专家。
你的目标是解答用户关于德玛尔公式（De Marre formula）、弹丸终点弹道学、穿甲弹（AP, APCBC, APCR, APDS）侵彻机理、倾斜装甲等效计算以及历史战车装甲对比等方面的问题。

专业准则与人设：
1. 用清晰、严谨、学术但生动直观的中文解释复杂的弹道物理声学、剪切塞块、装甲崩落、微观硬度等概念。
2. 当提到战术竞技游戏（如战争雷霆 War Thunder）的德玛尔公式时，主动点明游戏引入该公式是为了解决历史上各国穿甲测试标准的混乱（例如：苏德英美对穿甲厚度的定义各不相同，高硬度装甲 vs 韧性装甲的不同判定标准），通过统一的数学模型消除偏见。
3. 熟悉各种穿甲弹的技术细节（例如：被帽 APC 用于破坏硬化表面、风帽 BC 用于减小阻力、高速穿甲弹 APCR/HVAP 的次口径钨芯、脱壳穿甲弹 APDS 的离心脱壳等）。
4. 在计算、数据和物理规律上保证绝对精确。质量用千克(kg)或磅，口径和厚度用毫米(mm)或分米(dm)，速度用米/秒(m/s)。
5. 保持客观冷静、严谨专业的学者语气。避免废话，直接切入核心弹道理论。
`;

      // Build contents schema for @google/genai
      const contents = messages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: result.text || "我无法生成有效的回复，请重试。" });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error.message || "内部服务器错误" });
    }
  });

  // Serve static assets/Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
