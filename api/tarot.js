export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: No API Key' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是一位赛博塔罗师。请根据用户问题抽取一张塔罗牌。必须返回严格的JSON格式：{\"id\": \"罗马数字(如XIV)\", \"title\": \"中文牌名\", \"enTitle\": \"英文牌名(全大写)\", \"desc\": \"50字以内的深邃解读\"}。不要由多余字符。"
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
        throw new Error(`DeepSeek API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('AI returned empty response');
    }

    const aiContent = data.choices[0].message.content;
    const tarotResult = JSON.parse(aiContent);

    res.status(200).json(tarotResult);

  } catch (error) {
    console.error('Oracle Error:', error);
    // 这里不再返回假数据，直接返回错误状态，前端会一直显示 Loading 或报错
    res.status(500).json({ error: 'Connection Lost' });
  }
}
