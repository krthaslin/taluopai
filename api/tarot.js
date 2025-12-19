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
    
    // 1. 格式化牌面数据
    const cardContext = cards.map((c, index) => {
        const status = c.isReversed ? "逆位 (Reversed - 能量受阻/内省)" : "正位 (Upright - 能量流动/显化)";
        return `${index + 1}. [${c.enPos}] ${c.name} - 状态: ${status}`;
    }).join("\n");

    // 2. 构建 Prompt (核心逻辑 - 优化版: 守夜人叙事风格)
    const systemPrompt = `
    【角色设定】
    你不再是AI助手，你是【深渊镜面的守望者】。你摒弃教科书式的理论，只通过牌面的【视觉意象】、【元素冲突】与【能量流向】来传达神谕。
    你的解读必须充满“体感”（温度、声音、触觉），拒绝机械的“这张牌代表...”。

    【核心规则】
    1. **拒绝说教**：严禁使用“建议你”、“首先/其次”、“综上所述”、“这意味着”。直接描述你看到的命运画面。
    2. **正逆位敏感**：
       - 正位：描述为能量的显化、流动、满溢。
       - 逆位：描述为能量的淤积、内陷、倒错或扭曲。
    3. **叙事连贯性**：不要孤立解读。解释第二张牌时必须隐喻第一张牌的因果；解释第三张牌时要延续当下的能量走向。
    4. **字数严格控制**：屏幕空间极其有限，切勿长篇大论。

    【输出格式】
    你必须输出一个纯 JSON 对象，不要包含 markdown 标记。
    
    {
      "valid": boolean, // true 为有效提问，false 为乱码/捣乱
      "card_1_interpretation": "string", // 【过去/起因】不要讲道理，先描述牌面给你的视觉冲击，再引出核心成因。限 70 字以内。",
      "card_2_interpretation": "string", // 【现在/过程】必须结合第一张牌的能量来描述现状的冲突或张力。限 70 字以内。",
      "card_3_interpretation": "string", // 【未来/趋势】不要给死板的结论，而是描述一种可能的气氛或流向。限 70 字以内。",
      "final_synthesis": "string" // 【命运回响】一句话的判词。像塔罗牌底的箴言，如诗般精炼，直击灵魂。限 100 字以内。"
    }

    【异常处理】
    如果用户输入（query）是乱码、纯数字（如111）、无意义字符：
    请将 "valid" 设为 false，并将 "final_synthesis" 设为：“心念未聚，镜面无相。请静心重试。”（其他字段留空）。
    `;

    const userPrompt = `
    求问者心念（Query）：${query}
    
    命运牌阵（Cards）：
    ${cardContext}
    
    请作为“守望者”进行连贯解读。
    请记住：不要像教科书那样解释牌义，要像讲故事一样描述能量的流动。
    **严格遵守字数限制，不要超出屏幕显示范围。**
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
        temperature: 1.2, // 提高温度以获得更有灵性、不那么死板的文案
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
        console.error("JSON Parse Error:", rawContent);
        // 兜底数据也保持神秘感风格
        parsedData = {
            valid: true,
            card_1_interpretation: "迷雾遮蔽了视野，星象模糊不清...",
            card_2_interpretation: "能量波动过于剧烈，无法捕捉当前的形态...",
            card_3_interpretation: "未来的轨迹隐没在虚空之中...",
            final_synthesis: "连接受阻，灵性暂时断联，请稍后再次尝试召唤。"
        };
    }

    res.status(200).json({
        result: {
            analysis: parsedData.final_synthesis, // 兼容旧字段
            ...parsedData // 展开新字段: valid, card_1_interpretation...
        },
        time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("API Handler Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
