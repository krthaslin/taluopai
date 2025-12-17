export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, cards } = req.body; // 接收用户问题 + 前端抽好的3张牌
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'No API Key found' });
  }

  try {
    const startTime = Date.now();
    
    // 构建提示词：告诉 AI 牌已经抽好了，请解释
    const cardText = cards.map(c => `${c.position}: ${c.name} (${c.keywords})`).join(", ");
    
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 1.2, // 保持灵性
        messages: [
          {
            role: "system",
            content: `你是一位高深莫测的塔罗师。用户已经抽取了三张牌（过去、现在、未来）。
            
            请根据牌面含义和流变关系，结合用户的问题，给出一场**连贯、富有洞察力**的最终解读。
            
            要求：
            1. 不要机械地一张张解释，而是将三者串联成一个故事或指引。
            2. 语气神秘、优雅、直击人心。
            3. 字数控制在 100 字以内。
            4. 必须返回纯净 JSON 格式：{"analysis": "你的解读内容..."}`
          },
          {
            role: "user",
            content: `用户疑惑：${query}\n牌阵结果：${cardText}`
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
    
    // 简单的 JSON 提取
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("无有效 JSON");
    
    const parsedData = JSON.parse(jsonMatch[0]);

    res.status(200).json({
        result: parsedData,
        time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
