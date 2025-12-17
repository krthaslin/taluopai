export default async function handler(req, res) {
  // 允许跨域，方便调试
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
        temperature: 1.3, // 高创造性，让解读更丰富
        messages: [
          {
            role: "system",
            // --- 核心修改：全中文 Prompt ---
            content: "你是一位精通命运的塔罗师。请根据用户的问题抽一张牌，并给予深邃的指引。必须返回纯净的 JSON 格式，严禁包含 Markdown 标记或其他废话。返回格式：{\"id\": \"罗马数字(如 X, XII)\", \"title\": \"中文牌名\", \"enTitle\": \"英文牌名(全大写)\", \"desc\": \"50字以内的中文解读，语气神秘且富有哲理\"}。"
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
    
    // --- 外科手术式 JSON 提取 (保持不变，这层保险很有用) ---
    const jsonStartIndex = rawContent.indexOf('{');
    const jsonEndIndex = rawContent.lastIndexOf('}');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
        throw new Error("AI did not return a valid JSON object");
    }

    const cleanContent = rawContent.substring(jsonStartIndex, jsonEndIndex + 1);
    
    let parsedData;
    try {
        parsedData = JSON.parse(cleanContent);
    } catch (e) {
        throw new Error("JSON Parse Failed: " + cleanContent);
    }

    // 返回结果
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
