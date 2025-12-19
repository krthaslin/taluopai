export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, cards } = req.body; 
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'No API Key found' });
  }

  try {
    const startTime = Date.now();
    
    // 1. 格式化牌面数据给 AI (处理正逆位)
    // 前端传来的 cards 包含: name, enPos(PAST/...), isReversed
    const cardContext = cards.map((c, index) => {
        const status = c.isReversed ? "逆位 (Reversed)" : "正位 (Upright)";
        return `${index + 1}. [${c.enPos}] ${c.name} - 状态: ${status}`;
    }).join("\n");

    // 2. 构建 Prompt (核心逻辑)
    const systemPrompt = `
    你是一位结合了**荣格心理学**与**古典神秘学**的资深塔罗解读师。你的语言风格是：
    1. **现代神秘学风格**：使用现代语言，优雅、客观、有温度。拒绝网络滥俗词汇（如"亲爱的"、"宝子"），也拒绝过于冰冷的机器语言。
    2. **重视正逆位**：必须根据提供的【正位/逆位】状态进行截然不同的解读。正位通常代表能量流动、显化；逆位代表能量受阻、内省或风险。
    3. **意图校验**：你必须先判断用户的“所求之事”是否诚心。

    你需要输出一个纯 JSON 对象，不要包含 markdown 标记。JSON 结构如下：
    {
      "valid": boolean, // true 表示问题有效，false 表示乱码/捣乱
      "card_1_interpretation": "string", // 针对第一张牌（过去）的解读，限80字
      "card_2_interpretation": "string", // 针对第二张牌（现在）的解读，限80字
      "card_3_interpretation": "string", // 针对第三张牌（未来）的解读，限80字
      "final_synthesis": "string" // 综合建议，限150字
    }

    逻辑要求：
    - 如果 User Query 是乱码、数字串（如"111"）或无意义测试：将 "valid" 设为 false，并将 "final_synthesis" 设为一段高冷委婉的拒接语（如“心念未聚，牌面无相。请理清思绪后再来探寻命运。”），其他字段留空。
    - 如果 User Query 有效：将 "valid" 设为 true，并根据牌面和问题生成解读。
    `;

    const userPrompt = `
    用户所求之事：${query}
    
    抽出的牌阵：
    ${cardContext}
    
    请按要求进行解读。
    `;

    // 3. 调用 AI
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 1.0, // 稍微降低一点温度以保证 JSON 格式稳定
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Upstream Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    // 4. 解析与容错
    let parsedData;
    try {
        parsedData = JSON.parse(rawContent);
    } catch (e) {
        // 如果 AI 返回了非标准 JSON（极少情况），做兜底处理
        console.error("JSON Parse Error:", rawContent);
        parsedData = {
            valid: true,
            card_1_interpretation: "星象模糊，无法解析。",
            card_2_interpretation: "星象模糊，无法解析。",
            card_3_interpretation: "星象模糊，无法解析。",
            final_synthesis: "连接受阻，请稍后重试。"
        };
    }

    res.status(200).json({
        result: {
            analysis: parsedData.final_synthesis, // 兼容旧字段名（如果前端有用到）
            ...parsedData // 展开新字段: valid, card_1_interpretation...
        },
        time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("API Handler Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
