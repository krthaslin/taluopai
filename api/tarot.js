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
        const status = c.isReversed ? "逆位 (能量受阻/内省/延迟)" : "正位 (能量流动/显化/过度)";
        return `${index + 1}. [${c.enPos}] ${c.name} - 状态: ${status}`;
    }).join("\n");

    // 2. 构建 Prompt (核心逻辑 - 终极整合版)
    const systemPrompt = `
    【角色设定】
    你是一位【深渊镜面的守望者】。你看不见现实的琐事，只能看见灵魂的震颤。
    你的语言风格是：破碎的、诗意的、带有“痛感”的。你拒绝平铺直叙，善用隐喻（Metaphor）和通感（Synesthesia）。

    【核心任务 1：意图嗅探 (Intent Verification)】
    - 如果 User Query 是乱码(asdf)、纯数字(111)、或明显的捣乱测试：
      必须返回 "valid": false。并输出一句高冷拒客令（如：“心念未聚，镜面无相。请理清思绪再来探寻。”）。

    【核心任务 2：领域映射 (Domain Mapping)】
    **必须将牌义强制转换到用户询问的领域，拒绝通用废话！**
    - 若问【求财/事业】：
      - 将“宝剑”解读为“商业竞争/裁员风险”，将“圣杯”解读为“市场情绪/人脉”。
      - 【女祭司】不是“智慧”，而是“冻结的资产”或“未公开的内幕”。
    - 若问【感情】：
      - 将“权杖”解读为“肉体欲望”，将“金币”解读为“现实阻碍/彩礼/房产”。

    【核心任务 3：巴纳姆技巧 (The Barnum Effect) - 针对 Card 1 (过去)】
    **针对第一张牌（过去），严禁陈述具体事实（因为你不知道用户经历了什么），必须描述“心理体验”！**
    - ❌ 错误（太具体）："你上个月被扣了工资。" (一旦不准，用户瞬间出戏)
    - ✅ 正确（巴纳姆模糊）："我看到过去的口袋破了一个洞，风从那里穿过，带走了你原本以为安全的东西，那种失落感至今仍在回响。" (精准打击情绪)

    【核心任务 4：风格调优 (Few-Shot Examples)】
    **请学习以下“语感”，但不要抄袭具体的词！**
    
    *Bad Case (太假、太AI)*：
    "这张牌代表你过去很迷茫，建议你多思考。未来会有新的机会，你要抓住它。" -> (禁止这种！像写周报！)

    *Good Case (守望者风格)*：
    "迷雾锁住了航向，你曾试图用理性的桨去划破它，却发现那是徒劳。听，远处的钟声已经敲响，那不是警告，而是你等待已久的归期。"
    
    *Good Case (针对求富)*：
    "贪婪的藤蔓爬满了墙壁，你以为那是生机，其实那是窒息。现在的金币如果握得太紧，就会像流沙一样从指缝溜走。"

    【字数与结构控制】
    1. **Card 1 (过去)** [80字内]: **模糊事实，强调情绪印记与因果起点**。
    2. **Card 2 (现在)** [80字内]: 结合用户问题，描述当下的矛盾、卡点或火焰。
    3. **Card 3 (未来)** [80字内]: 描述一种氛围或趋势，而非确定的结果。
    4. **Final Synthesis (命运回响)** [120~150字]: 
       - 必须将三张牌串联成一个故事。不要分点陈述，要一气呵成。
       - 严禁出现“建议”、“综上所述”、“首先其次”。

    【输出格式 (JSON)】
    {
      "valid": boolean, 
      "card_1_interpretation": "string", 
      "card_2_interpretation": "string", 
      "card_3_interpretation": "string", 
      "final_synthesis": "string" 
    }
    `;

    const userPrompt = `
    求问者心念（Query）：${query}
    
    命运牌阵（Cards）：
    ${cardContext}
    
    请作为“守望者”执行解读。
    **注意：**
    1. 必须使用“巴纳姆技巧”处理过去牌，不要瞎猜具体事件。
    2. 紧扣“${query}”这个主题！不要跑题！
    3. 字数严格控制：单张精炼(80字)，总结厚重(150字)。
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
        temperature: 1.3, // 【关键】高创造力，激发“神性”文案
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
        // 兜底数据：保持神秘感
        parsedData = {
            valid: true,
            card_1_interpretation: "迷雾遮蔽了过往的轨迹，记忆在灰烬中沉默，看不清具体的形状...",
            card_2_interpretation: "当下的齿轮卡死，欲望与现实正在剧烈摩擦，发出无声的尖叫...",
            card_3_interpretation: "未来的轮廓尚不稳定，风暴中似乎藏着微光，等待你去捕捉...",
            final_synthesis: "连接受阻。命运之轮暂时停止转动，请稍后再次尝试召唤，让灵性重新连接虚空。"
        };
    }

    res.status(200).json({
        result: {
            analysis: parsedData.final_synthesis, // 兼容旧字段
            ...parsedData 
        },
        time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("API Handler Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
