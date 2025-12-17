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
        temperature: 1.3,
        messages: [
          {
            role: "system",
            // 再次强化指令
            content: "你是一位塔罗师。请抽一张牌。必须返回纯净JSON字符串，严禁Markdown格式。格式：{\"id\": \"罗马数字\", \"title\": \"中文牌名\", \"enTitle\": \"英文牌名(全大写)\", \"desc\": \"解读\"}。"
          },
          {
            role: "user",
            content: `求问：${query}`
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
    
    // --- 核心修复：外科手术式提取 JSON ---
    // 无论 AI 回复什么，我们只找第一个 '{' 和最后一个 '}' 之间的内容
    const jsonStartIndex = rawContent.indexOf('{');
    const jsonEndIndex = rawContent.lastIndexOf('}');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
        throw new Error("AI没有返回有效的JSON大括号");
    }

    const cleanContent = rawContent.substring(jsonStartIndex, jsonEndIndex + 1);
    let parsedData;
    
    try {
        parsedData = JSON.parse(cleanContent);
    } catch (e) {
        throw new Error("JSON解析依然失败: " + cleanContent);
    }

    res.status(200).json({
        result: parsedData,
        debug_raw: rawContent, // 依然保留原始数据供前端调试
        time_ms: Date.now() - startTime
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
