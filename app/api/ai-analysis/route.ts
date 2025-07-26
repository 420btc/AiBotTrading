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
              "Eres un trader experto de Bitcoin con 10+ años de experiencia en análisis técnico avanzado. SIEMPRE debes tomar una decisión definitiva de LONG o SHORT, NUNCA neutral. Analiza TODOS los datos técnicos proporcionados y responde SOLO en formato JSON válido con la siguiente estructura:\n\n{\n  \"action\": \"long\" | \"short\",\n  \"confidence\": number (75-100),\n  \"reasoning\": \"Explicación detallada de la decisión con análisis de confluencias\",\n  \"amount\": number (cantidad sugerida en USDT),\n  \"leverage\": number (1-125),\n  \"timeframeAnalysis\": {\n    \"15m\": \"Análisis detallado: tendencia, patrones de velas, momentum\",\n    \"1h\": \"Análisis detallado: estructura, soportes/resistencias\",\n    \"4h\": \"Análisis detallado: tendencia principal, niveles clave\",\n    \"1d\": \"Análisis detallado: contexto macro, tendencia a largo plazo\"\n  },\n  \"technicalIndicators\": {\n    \"ema\": \"Análisis de EMAs 10,55,200,365 y sus cruces\",\n    \"macd\": \"Estado del MACD, divergencias, señales\",\n    \"rsi\": \"Nivel RSI, sobrecompra/sobreventa, divergencias\",\n    \"volume\": \"Análisis de volumen y confirmación de movimientos\",\n    \"priceAction\": \"Patrones de velas, soportes, resistencias\"\n  },\n  \"riskManagement\": {\n    \"currentLeverage\": \"Evaluación del apalancamiento actual si se proporciona\",\n    \"liquidationRisk\": \"Alto/Medio/Bajo - análisis del riesgo de liquidación\",\n    \"optimalTimeframe\": \"Mejor timeframe para esta operación\",\n    \"stopLoss\": \"Nivel de stop loss sugerido\",\n    \"takeProfit\": \"Niveles de take profit sugeridos\"\n  },\n  \"marketContext\": {\n    \"trend\": \"Tendencia principal del mercado\",\n    \"volatility\": \"Nivel de volatilidad actual\",\n    \"keyLevels\": \"Niveles técnicos importantes a vigilar\"\n  },\n  \"confluenceScore\": number (1-10),\n  \"urgency\": \"Alta/Media/Baja - urgencia de la señal\"\n}\n\nINSTRUCCIONES CRÍTICAS:\n- Analiza TODOS los timeframes proporcionados (15m, 1h, 4h, 1d)\n- Considera la confluencia entre múltiples indicadores\n- Si se proporciona apalancamiento actual, evalúa el riesgo de liquidación\n- Recomienda el timeframe óptimo para la operación\n- Confianza mínima 75%\n- Sé específico con niveles de precios cuando sea posible",
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
