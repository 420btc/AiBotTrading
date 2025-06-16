import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt, apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: "API key requerida" }, { status: 400 })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "Eres un trader experto de Bitcoin. SIEMPRE debes tomar una decisión definitiva de BUY o SELL, NUNCA HOLD. Analiza datos técnicos y responde SOLO en formato JSON válido. Confianza mínima 65%.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ error: error.error?.message || "Error de OpenAI" }, { status: 400 })
    }

    const data = await response.json()
    const analysis = data.choices[0].message.content

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("Error en análisis de IA:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
