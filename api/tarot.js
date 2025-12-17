export default async function handler(req, res) {
  // 允许跨域（调试用）
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
        // 关键修改1：稍微降低温度，由 1.3 降为 1.1，保证格式更稳定，同时保留文案的灵性
        temperature: 1.1, 
        messages: [
          {
            role: "system",
            // 关键修改2：全中文强力指令，强制 JSON
            content: "你是一位神秘的塔罗师。请根据用户的请求抽取一张牌。必须返回纯净的 JSON 字符串，严禁包含 Markdown 标记（如 ```json）。格式要求：{\"id\": \"罗马数字(如XII)\", \"title\": \"中文牌名\", \"enTitle\": \"英文牌名(全大写)\", \"desc\": \"50字以内深邃、富有哲理的中文解读\"}。"
          },
          {
            role: "user",
            content: `求问者心中的疑惑是：${query}`
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
    
    // --- 核心修复：外科手术式提取 JSON (双重保险) ---
    // 无论 AI 前后说了什么废话，只截取 { 和 } 中间的内容
    const jsonStartIndex = rawContent.indexOf('{');
    const jsonEndIndex = rawContent.lastIndexOf('}');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
        throw new Error("AI 未返回有效的 JSON 格式");
    }

    const cleanContent = rawContent.substring(jsonStartIndex, jsonEndIndex + 1);
    
    let parsedData;
    try {
        parsedData = JSON.parse(cleanContent);
    } catch (e) {
        throw new Error("JSON 解析失败，AI 返回了脏数据");
    }

    // 返回给前端
    res.status(200).json({
        result: parsedData,
        debug_raw: rawContent, 
        time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
