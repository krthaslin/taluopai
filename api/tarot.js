export default async function handler(req, res) {
  // 1. 安全检查：只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: No API Key' });
  }

  try {
    // 2. 呼叫 DeepSeek 大脑
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 或者 deepseek-coder
        messages: [
          {
            role: "system",
            // 找到 api/tarot.js 里的这一行，替换为：
content: "你是一位存在于量子网络中的‘赛博塔罗师’。语气冷静、神秘、哲学。用户输入疑惑后，抽一张塔罗牌。请返回严格的JSON格式：{\"title\": \"中文牌名(如:愚者)\", \"enTitle\": \"英文牌名全大写(如:THE FOOL)\", \"id\": \"罗马数字(如:0)\", \"desc\": \"一句不超过50字的解读\"}。"
          },
          {
            role: "user",
            content: `求问者正在连接潜意识，心中的疑惑是：${query}`
          }
        ],
        response_format: { type: "json_object" } // 强制返回 JSON
      })
    });

    const data = await response.json();
    
    // 3. 解析 AI 返回的内容
    if (!data.choices || data.choices.length === 0) {
      throw new Error('AI returned empty response');
    }

    const aiContent = data.choices[0].message.content;
    const tarotResult = JSON.parse(aiContent);

    // 4. 发回给前端
    res.status(200).json(tarotResult);

  } catch (error) {
    console.error('Oracle Error:', error);
    // 兜底方案：如果 AI 挂了，随机返回一个本地结果，保证用户体验不中断
    res.status(200).json({
      title: "命运之轮 · 离线",
      icon: "🛜",
      desc: "与主脑的连接暂时中断，但命运显示：此刻的静默也是一种答案。请稍后再试。"
    });
  }
}
