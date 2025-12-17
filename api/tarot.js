export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'No API Key found' });
  }

  try {
    const response = await fetch('[https://api.deepseek.com/chat/completions](https://api.deepseek.com/chat/completions)', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        // 关键修改：调高温度，增加随机性
        temperature: 1.3, 
        messages: [
          {
            role: "system",
            // 关键修改：强硬的 System Prompt，禁止输出 Markdown，防止解析失败
            content: "你是一位赛博塔罗师。根据用户问题抽一张塔罗牌。必须返回纯净的JSON字符串，严禁使用markdown格式（即不要写```json）。格式：{\"id\": \"罗马数字\", \"title\": \"牌名\", \"enTitle\": \"英文牌名全大写\", \"desc\": \"50字以内解读\"}。"
          },
          {
            role: "user",
            content: `求问者：${query}。请给出指引。`
          }
        ],
        // 强制 JSON 模式（双重保险）
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`DeepSeek Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const aiContent = data.choices[0].message.content;
    
    // 发回给前端
    res.status(200).json({ raw: aiContent });

  } catch (error) {
    console.error('API Fail:', error);
    res.status(500).json({ error: error.message });
  }
}
