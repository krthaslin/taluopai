export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
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
        temperature: 1.1, // 保持 1.1，兼顾稳定与创意
        messages: [
          {
            role: "system",
            // ⭐️ 核心修改：以“API 接口”的身份要求 AI，比要求它做“塔罗师”更听话
            content: `你是一个只输出 JSON 数据的后端 API。
            用户会输入一个问题，你需要模拟塔罗师的口吻生成结果。
            
            严禁输出任何 Markdown 格式（如 \`\`\`json ）。
            严禁输出任何开场白（如“好的”）。
            只输出一个 JSON 对象，必须包含以下字段：
            {
              "id": "罗马数字(如 X)",
              "title": "中文牌名",
              "enTitle": "英文牌名(全大写)",
              "desc": "50字以内的深邃中文解读"
            }`
          },
          {
            role: "user",
            content: query
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
        throw new Error(`Upstream Error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    // --- 🛡️ 容错提取升级：正则暴力匹配 ---
    // 即使 AI 加了废话，这段正则也能精准抠出最外层的 {}
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
        throw new Error("AI 返回内容不包含有效的 JSON 对象");
    }

    const cleanContent = jsonMatch[0];
    let parsedData;
    
    try {
        parsedData = JSON.parse(cleanContent);
    } catch (e) {
        throw new Error("JSON 语法错误，无法解析");
    }

    // --- 🛡️ 字段安检：缺啥补啥，防止前端 undefined ---
    if (!parsedData.id) parsedData.id = "XXII"; // 兜底编号
    if (!parsedData.title) parsedData.title = "迷雾"; // 兜底标题
    if (!parsedData.enTitle) parsedData.enTitle = "THE UNKNOWN";
    if (!parsedData.desc) parsedData.desc = "命运的启示模糊不清，请用心感受。";

    res.status(200).json({
        result: parsedData,
        debug_raw: rawContent, 
        time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
