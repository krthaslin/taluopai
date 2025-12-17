export default async function handler(req, res) {
  // Allow CORS for debugging
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
        temperature: 1.3, // High creativity
        messages: [
          {
            role: "system",
            // Stricter prompt
            content: "You are a Tarot Reader. Output ONLY a valid JSON object. No markdown, no conversational text. Format: {\"id\": \"Roman Numeral\", \"title\": \"Card Name\", \"enTitle\": \"English Name\", \"desc\": \"Reading under 50 words\"}."
          },
          {
            role: "user",
            content: `Question: ${query}`
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
    
    // --- Surgical JSON Extraction ---
    // This ignores everything before the first '{' and after the last '}'
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

    // Send back result AND debug info
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
