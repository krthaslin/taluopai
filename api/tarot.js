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
        temperature: 1.4, // 高随机性
        messages: [
          {
            role: "system",
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
    
    // 清洗 Markdown
    let cleanContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    let parsedData = JSON.parse(cleanContent);

    // --- 关键修改：把原始数据包在 debug 字段里发回去 ---
    res.status(200).json({
        result: parsedData,       // 解析后的可用数据
        debug_raw: rawContent,    // AI 的原始回复 (给你看的)
        time_ms: Date.now() - startTime // 耗时
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
