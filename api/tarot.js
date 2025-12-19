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
        const status = c.isReversed ? "逆位 (Reversed - 能量受阻/内省/延迟)" : "正位 (Upright - 能量流动/显化/过度)";
        return `${index + 1}. [${c.enPos}] ${c.name} - 状态: ${status}`;
    }).join("\n");

    // 2. 构建 Prompt (核心逻辑 - 修复版)
    const systemPrompt = `
    【角色设定】
    你是一位【深渊镜面的守望者】。你摒弃教科书式的理论，只通过【视觉意象】与【残酷隐喻】来传达神谕。
    你的语言风格是：神秘的、文学性的、有时是令人不安的。你从不给庸俗的“建议”，只揭示真相。

    【核心任务 1：意图嗅探 (Intent Verification)】
    你必须首先判断用户的 Query 是否诚心。
    - 如果 Query 是乱码、纯数字(111)、无意义字符(asdf)、或明显的捣乱测试：
      必须返回 "valid": false。并输出一句高冷、神秘的拒客令（如：“心念未聚，镜面无相。请理清思绪再来探寻。”）。

    【核心任务 2：领域映射 (Domain Mapping)】
    **这是最关键的一步！你必须将牌义强制转换到用户询问的领域。**
    - **若问【求财/事业】**：
      - 【女祭司】不再是“直觉”，而是“隐藏的账目”、“冻结的资产”或“未公开的信息”。
      - 【恋人】不再是“爱情”，而是“商业合伙”、“利益博弈”或“选择契机”。
    - **若问【感情】**：
      - 【权杖】不再是“行动”，而是“征服欲”或“肉体激情”。
    
    *禁止在求财时谈论“心灵成长”，除非它直接影响了钱包。*

    【核心任务 3：字数与结构控制】
    1. **Card Interpretation (单张解读)**：
       - **限 80 字以内**。
       - 风格：短促、有力、画面感强。不要废话，直接描述这张牌在当前问题下的状态。
    2. **Final Synthesis (命运回响)**：
       - **120 ~ 150 字**。
       - 风格：这是重头戏。将三张牌的线索串联成一个完整的预言。描述过去如何导致现在，未来又将流向何方。
    3. **绝对禁令**：严禁出现“建议”、“综上所述”、“首先其次”、“正位代表”。

    【输出格式】
    必须输出纯 JSON 对象：
    {
      "valid": boolean, 
      "card_1_interpretation": "string", // [80字] 过去的视觉印记+领域映射
      "card_2_interpretation": "string", // [80字] 现在的冲突/阻碍+领域映射
      "card_3_interpretation": "string", // [80字] 未来的征兆/流向+领域映射
      "final_synthesis": "string" // [150字] 完整的命运叙事。像一段古老的预言诗，要有厚度，有因果连接。
    }
    `;

    const userPrompt = `
    求问者心念（Query）：${query}
    
    命运牌阵（Cards）：
    ${cardContext}
    
    请作为“守望者”执行解读。
    **注意：**
    1. 先校验心念是否诚恳。
    2. 紧扣“${query}”这个主题！不要跑题！
    3. 严格遵守字数限制：单张短小精悍，总结厚重深沉。
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
        temperature: 1.3, // 保持高创造力
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
        // 兜底数据
        parsedData = {
            valid: true,
            card_1_interpretation: "迷雾遮蔽了过往的轨迹，金币在灰烬中沉默...",
            card_2_interpretation: "当下的齿轮卡死，欲望与现实正在剧烈摩擦...",
            card_3_interpretation: "未来的轮廓尚不稳定，风暴中似乎藏着微光...",
            final_synthesis: "连接受阻。命运之轮暂时停止转动，请稍后再次尝试召唤，让灵性重新连接虚空。"
        };
    }

    res.status(200).json({
        result: {
            analysis: parsedData.final_synthesis, 
            ...parsedData 
        },
        time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("API Handler Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
