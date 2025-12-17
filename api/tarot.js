export default async function handler(req, res) {
  // 1. 允许跨域（方便本地调试）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  console.log("💡 [1] 收到请求，问题:", query); // 日志埋点

  if (!apiKey) {
    console.error("❌ [Error] 没有找到 API Key");
    return res.status(500).json({ error: 'No API Key found' });
  }

  try {
    const startTime = Date.now();
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 1.4, // 进一步调高创造性
        messages: [
          {
            role: "system",
            // 极其严厉的 Prompt，防止 AI 废话
            content: "你是一位神秘的塔罗师。请抽一张牌。必须直接返回JSON对象，严禁Markdown格式，严禁```开头。格式：{\"id\": \"罗马数字\", \"title\": \"中文牌名\", \"enTitle\": \"英文牌名(全大写)\", \"desc\": \"解读\"}。"
          },
          {
            role: "user",
            content: `求问：${query}`
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const endTime = Date.now();
    console.log(`⏱️ [2] DeepSeek 响应耗时: ${endTime - startTime}ms`);

    if (!response.ok) {
        const errText = await response.text();
        console.error("❌ [Error] DeepSeek API 报错:", response.status, errText);
        throw new Error(`Upstream Error: ${response.status}`);
    }

    const data = await response.json();
    
    // --- 关键调试点：打印 AI 原始回复 ---
    const rawContent = data.choices[0].message.content;
    console.log("📝 [3] AI 原始回复 (Raw):", rawContent); 
    // ----------------------------------

    // 尝试清洗数据（防止 AI 不听话加了 markdown）
    let cleanContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
        const parsedData = JSON.parse(cleanContent);
        console.log("✅ [4] JSON 解析成功:", parsedData.title);
        res.status(200).json(parsedData);
    } catch (e) {
        console.error("❌ [Error] JSON 解析失败. 原始内容:", cleanContent);
        throw new Error("AI returned invalid JSON");
    }

  } catch (error) {
    console.error("💥 [Fatal] 服务器内部错误:", error);
    res.status(500).json({ error: error.message, details: "Check Vercel Logs" });
  }
}
