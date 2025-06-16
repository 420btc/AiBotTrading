"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Play, Pause, TrendingUp, TrendingDown } from "lucide-react"

interface AITradingPanelProps {
  apiKeys: { openai: string }
  balance: number
  setBalance: (balance: number) => void
  positions: any[]
  setPositions: (positions: any[]) => void
}

interface AIDecision {
  action: "buy" | "sell" | "hold"
  confidence: number
  reasoning: string
  amount: number
  leverage: number
}

export function AITradingPanel({ apiKeys, balance, setBalance, positions, setPositions }: AITradingPanelProps) {
  const [isAIActive, setIsAIActive] = useState(false)
  const [aiDecisions, setAIDecisions] = useState<AIDecision[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState("")
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false)
  const [riskLevel, setRiskLevel] = useState("medium")
  const [maxPositionSize, setMaxPositionSize] = useState("100")

  const analyzeMarket = async () => {
    if (!apiKeys.openai) {
      alert("Por favor configura tu API key de OpenAI primero")
      return
    }

    try {
      // Obtener datos actuales del mercado
      const priceResponse = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
      const priceData = await priceResponse.json()

      const currentPrice = Number.parseFloat(priceData.lastPrice)
      const priceChange = Number.parseFloat(priceData.priceChangePercent)
      const volume = Number.parseFloat(priceData.volume)

      // Simular indicadores técnicos (en implementación real vendrían del componente de gráfico)
      const indicators = {
        rsi: 65.8,
        macd: { value: 125.45, signal: 98.23, histogram: 27.22 },
        ema10: 49850.23,
        ema55: 49200.45,
        ema200: 48500.12,
        volume: volume,
      }

      const marketData = {
        price: currentPrice,
        priceChange: priceChange,
        indicators: indicators,
        balance: balance,
        activePositions: positions.length,
      }

      // Llamar a OpenAI para análisis
      const aiAnalysis = await callOpenAI(marketData)
      setCurrentAnalysis(aiAnalysis.reasoning)

      const newDecision: AIDecision = {
        action: aiAnalysis.action,
        confidence: aiAnalysis.confidence,
        reasoning: aiAnalysis.reasoning,
        amount: aiAnalysis.amount,
        leverage: aiAnalysis.leverage,
      }

      setAIDecisions((prev) => [newDecision, ...prev.slice(0, 9)])

      // Ejecutar automáticamente si está habilitado
      if (autoTradingEnabled && aiAnalysis.confidence > 70) {
        await executeAIDecision(newDecision, currentPrice)
      }
    } catch (error) {
      console.error("Error en análisis de IA:", error)
    }
  }

  const callOpenAI = async (marketData: any): Promise<AIDecision> => {
    const prompt = `
    Eres un trader experto de Bitcoin. Analiza los siguientes datos de mercado y toma una decisión de trading:

    Precio actual: $${marketData.price}
    Cambio 24h: ${marketData.priceChange}%
    RSI: ${marketData.indicators.rsi}
    MACD: ${marketData.indicators.macd.value} (Señal: ${marketData.indicators.macd.signal})
    EMA10: $${marketData.indicators.ema10}
    EMA55: $${marketData.indicators.ema55}
    EMA200: $${marketData.indicators.ema200}
    Volumen: ${marketData.indicators.volume}
    Balance disponible: $${marketData.balance}
    Posiciones activas: ${marketData.activePositions}

    Basándote en estos indicadores técnicos, decide:
    1. Acción: buy, sell, o hold
    2. Nivel de confianza (0-100)
    3. Cantidad a invertir (máximo $${maxPositionSize})
    4. Apalancamiento recomendado (1-10x)
    5. Razonamiento detallado

    Responde en formato JSON:
    {
      "action": "buy|sell|hold",
      "confidence": 85,
      "amount": 50,
      "leverage": 2,
      "reasoning": "Explicación detallada de la decisión"
    }
    `

    try {
      const response = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          apiKey: apiKeys.openai,
        }),
      })

      if (!response.ok) {
        throw new Error("Error en la respuesta de OpenAI")
      }

      const result = await response.json()
      return JSON.parse(result.analysis)
    } catch (error) {
      console.error("Error llamando a OpenAI:", error)
      // Fallback con decisión básica
      return {
        action: "hold",
        confidence: 50,
        amount: 50,
        leverage: 1,
        reasoning: "Error en análisis de IA, manteniendo posición conservadora",
      }
    }
  }

  const executeAIDecision = async (decision: AIDecision, currentPrice: number) => {
    if (decision.action === "hold") return

    const totalCost = decision.amount / decision.leverage

    if (totalCost > balance) {
      console.log("Fondos insuficientes para ejecutar decisión de IA")
      return
    }

    const newPosition = {
      id: Date.now().toString(),
      type: decision.action === "buy" ? "long" : "short",
      amount: decision.amount,
      entryPrice: currentPrice,
      leverage: decision.leverage,
      timestamp: Date.now(),
      isAI: true,
    }

    setPositions([...positions, newPosition])
    setBalance(balance - totalCost)

    console.log(`IA ejecutó: ${decision.action.toUpperCase()} $${decision.amount} BTC a $${currentPrice}`)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isAIActive) {
      // Analizar cada 30 segundos cuando está activo
      interval = setInterval(analyzeMarket, 30000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAIActive, apiKeys.openai, autoTradingEnabled])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center space-x-2">
          <Bot className="h-6 w-6" />
          <span>IA Trading</span>
        </h2>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setIsAIActive(!isAIActive)}
            variant={isAIActive ? "destructive" : "default"}
            className="flex items-center space-x-2"
          >
            {isAIActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isAIActive ? "Detener" : "Iniciar"} IA</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuración de IA */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-trading">Trading Automático</Label>
              <Switch id="auto-trading" checked={autoTradingEnabled} onCheckedChange={setAutoTradingEnabled} />
            </div>

            <div className="space-y-2">
              <Label>Tamaño Máximo de Posición</Label>
              <Input
                type="number"
                value={maxPositionSize}
                onChange={(e) => setMaxPositionSize(e.target.value)}
                placeholder="Máximo USD por operación"
              />
            </div>

            <div className="space-y-2">
              <Label>Nivel de Riesgo</Label>
              <select
                className="w-full p-2 border rounded"
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
              >
                <option value="low">Bajo (1-2x leverage)</option>
                <option value="medium">Medio (2-5x leverage)</option>
                <option value="high">Alto (5-10x leverage)</option>
              </select>
            </div>

            <Button onClick={analyzeMarket} className="w-full" disabled={!apiKeys.openai}>
              Analizar Mercado Ahora
            </Button>
          </CardContent>
        </Card>

        {/* Análisis Actual */}
        <Card>
          <CardHeader>
            <CardTitle>Análisis Actual</CardTitle>
          </CardHeader>
          <CardContent>
            {currentAnalysis ? (
              <div className="space-y-3">
                <Textarea value={currentAnalysis} readOnly className="min-h-[200px]" />
                <div className="text-xs text-muted-foreground">
                  Última actualización: {new Date().toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Inicia el análisis de IA para ver recomendaciones</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial de Decisiones */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Decisiones de IA</CardTitle>
        </CardHeader>
        <CardContent>
          {aiDecisions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No hay decisiones de IA registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {aiDecisions.map((decision, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {decision.action === "buy" ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : decision.action === "sell" ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-gray-400" />
                      )}
                      <Badge
                        variant={
                          decision.action === "buy"
                            ? "default"
                            : decision.action === "sell"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {decision.action.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-semibold">
                        ${decision.amount} ({decision.leverage}x)
                      </span>
                    </div>
                    <Badge variant="outline">{decision.confidence}% confianza</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{decision.reasoning}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
