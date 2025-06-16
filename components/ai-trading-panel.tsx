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
  setBalance: React.Dispatch<React.SetStateAction<number>>
  positions: any[]
  setPositions: React.Dispatch<React.SetStateAction<any[]>>
}

interface AIDecision {
  action: "buy" | "sell" | "hold" | "close"
  confidence: number
  reasoning: string
  amount: number
  leverage: number
}

interface PositionHistory {
  id: string
  type: "long" | "short"
  amount: number
  entryPrice: number
  exitPrice?: number
  leverage: number
  timestamp: number
  closedAt?: number
  pnl?: number
  status: "open" | "closed" | "liquidated"
  isAI: boolean
  reason?: string
}

export function AITradingPanel({ apiKeys, balance, setBalance, positions, setPositions }: AITradingPanelProps) {
  const [isAIActive, setIsAIActive] = useState(false)
  const [aiDecisions, setAIDecisions] = useState<AIDecision[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState("")
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false)
  const [riskLevel, setRiskLevel] = useState("medium")
  const [maxPositionSize, setMaxPositionSize] = useState("100")
  const [lastPositionTime, setLastPositionTime] = useState(0)
  const [positionHistory, setPositionHistory] = useState<PositionHistory[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)

  const calculatePNL = (position: any, currentPrice: number) => {
    if (position.type === 'long') {
      return ((currentPrice - position.entryPrice) / position.entryPrice) * position.amount * position.leverage
    } else {
      return ((position.entryPrice - currentPrice) / position.entryPrice) * position.amount * position.leverage
    }
  }

  const analyzeMarket = async () => {
    if (!apiKeys.openai) {
      alert("Por favor configura tu API key de OpenAI primero")
      return
    }

    try {
      // Obtener datos actuales del mercado
      const priceResponse = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
      const priceData = await priceResponse.json()

      const newCurrentPrice = Number.parseFloat(priceData.lastPrice)
      const priceChange = Number.parseFloat(priceData.priceChangePercent)
      const volume = Number.parseFloat(priceData.volume)
      
      setCurrentPrice(newCurrentPrice)

      // Simular indicadores técnicos (en implementación real vendrían del componente de gráfico)
      const indicators = {
        rsi: 65.8,
        macd: { value: 125.45, signal: 98.23, histogram: 27.22 },
        ema10: 49850.23,
        ema55: 49200.45,
        ema200: 48500.12,
        volume: volume,
      }

      // Verificar posiciones abiertas para posibles cierres con ganancia
      const openAIPositions = positions.filter(p => p.isAI && p.status !== 'closed')
      let shouldAnalyzeForClose = false
      
      for (const position of openAIPositions) {
        const pnl = calculatePNL(position, newCurrentPrice)
        if (pnl > 0) {
          shouldAnalyzeForClose = true
          break
        }
      }

      const marketData = {
        price: newCurrentPrice,
        priceChange: priceChange,
        indicators: indicators,
        balance: balance,
        activePositions: positions.length,
        openAIPositions: openAIPositions,
        shouldAnalyzeForClose: shouldAnalyzeForClose,
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
        await executeAIDecision(newDecision, newCurrentPrice)
      }
    } catch (error) {
      console.error("Error en análisis de IA:", error)
    }
  }

  const callOpenAI = async (marketData: any): Promise<AIDecision> => {
    const openPositionsInfo = marketData.openAIPositions.map((pos: any) => {
      const pnl = calculatePNL(pos, marketData.price)
      return `Posición ${pos.type}: $${pos.amount} a $${pos.entryPrice} (${pos.leverage}x) - PnL: $${pnl.toFixed(2)}`
    }).join('\n')

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
    
    POSICIONES ABIERTAS DE IA:
    ${openPositionsInfo || 'Ninguna posición abierta'}
    
    REGLAS IMPORTANTES:
    - Solo puedes abrir 1 nueva posición cada 5 minutos
    - Solo puedes cerrar posiciones que tengan ganancias (PnL > 0)
    - Nunca cierres posiciones con pérdidas
    - Prioriza cerrar posiciones con ganancias antes que abrir nuevas
    - OBLIGATORIO: Usa apalancamiento mínimo de 10x (rango: 10x-20x)

    Basándote en estos indicadores técnicos, decide:
    1. Acción: buy, sell, hold, o close (para cerrar posiciones con ganancia)
    2. Nivel de confianza (0-100)
    3. Cantidad a invertir (máximo $${maxPositionSize}) o ID de posición a cerrar
    4. Apalancamiento recomendado (MÍNIMO 10x, máximo 20x)
    5. Razonamiento detallado

    Responde en formato JSON:
    {
      "action": "buy|sell|hold|close",
      "confidence": 85,
      "amount": 50,
      "leverage": 2,
      "reasoning": "Explicación detallada de la decisión",
      "positionId": "id_si_es_close"
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
        leverage: 10,
        reasoning: "Error en análisis de IA, manteniendo posición conservadora con apalancamiento mínimo",
      }
    }
  }

  const executeAIDecision = async (decision: AIDecision, currentPrice: number) => {
    if (decision.action === "hold") return

    const now = Date.now()
    
    // Verificar límite de tiempo para cualquier acción (5 minutos = 300000ms)
    if (now - lastPositionTime < 300000) {
      console.log("Debe esperar 5 minutos antes de realizar cualquier acción (abrir o cerrar posición)")
      return
    }
    
    // Manejar cierre de posiciones
    if (decision.action === "close") {
      const openAIPositions = positions.filter(p => p.isAI && p.status !== 'closed')
      
      for (const position of openAIPositions) {
        const pnl = calculatePNL(position, currentPrice)
        if (pnl > 0) { // Solo cerrar con ganancias
          const closedPosition: PositionHistory = {
            ...position,
            exitPrice: currentPrice,
            closedAt: now,
            pnl: pnl,
            status: 'closed',
            reason: 'IA cerró con ganancia'
          }
          
          // Actualizar historial
          setPositionHistory(prev => [closedPosition, ...prev])
          
          // Remover de posiciones activas
          setPositions((prev: any[]) => prev.filter((p: any) => p.id !== position.id))
          
          // Devolver fondos + ganancia
          const totalReturn = (position.amount / position.leverage) + pnl
          setBalance((prev: number) => prev + totalReturn)
          
          // Actualizar el tiempo de la última acción
          setLastPositionTime(now)
          
          console.log(`IA cerró posición ${position.type} con ganancia: $${pnl.toFixed(2)}`)
          return
        }
      }
      return
    }

    // El límite de tiempo ya se verificó al inicio de la función

    // Verificar si ya hay una posición de IA abierta
    const hasOpenAIPosition = positions.some(p => p.isAI && p.status !== 'closed')
    if (hasOpenAIPosition) {
      console.log("Ya hay una posición de IA abierta. Solo se permite 1 posición a la vez.")
      return
    }

    // Validar apalancamiento mínimo
    if (decision.leverage < 10) {
      console.log(`Apalancamiento ${decision.leverage}x es menor al mínimo requerido (10x). Ajustando a 10x.`)
      decision.leverage = 10
    }

    const totalCost = decision.amount / decision.leverage

    if (totalCost > balance) {
      console.log("Fondos insuficientes para ejecutar decisión de IA")
      return
    }

    const newPosition = {
      id: Date.now().toString(),
      type: decision.action === "buy" ? "long" as const : "short" as const,
      amount: decision.amount,
      entryPrice: currentPrice,
      leverage: decision.leverage,
      timestamp: now,
      status: 'open' as const,
      isAI: true,
    }

    // Agregar al historial como posición abierta
    const historyEntry: PositionHistory = {
      ...newPosition,
      reason: 'IA abrió nueva posición'
    }
    
    setPositions((prev: any[]) => [...prev, newPosition])
    setPositionHistory((prev: PositionHistory[]) => [historyEntry, ...prev])
    setBalance((prev: number) => prev - totalCost)
    setLastPositionTime(now)

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

  // Efecto para actualizar el contador de tiempo en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      // Forzar re-render cada segundo para actualizar el contador
      setLastPositionTime(prev => prev)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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

      {/* Estado de Posiciones Activas */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Posiciones de IA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {positions.filter(p => p.isAI && p.status !== 'closed').length}
              </div>
              <div className="text-sm text-blue-600">Posiciones Abiertas</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Math.max(0, 300 - Math.floor((Date.now() - lastPositionTime) / 1000))}s
              </div>
              <div className="text-sm text-green-600">Próxima Posición</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {positionHistory.filter(p => p.status === 'closed' && p.pnl && p.pnl > 0).length}
              </div>
              <div className="text-sm text-purple-600">Posiciones Cerradas con Ganancia</div>
            </div>
          </div>
          
          {positions.filter(p => p.isAI && p.status !== 'closed').map((position) => {
            const pnl = calculatePNL(position, currentPrice)
            const pnlPercentage = ((pnl / (position.amount / position.leverage)) * 100)
            
            return (
              <div key={position.id} className="p-4 border rounded-lg mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant={position.type === 'long' ? 'default' : 'destructive'}>
                      {position.type.toUpperCase()}
                    </Badge>
                    <span className="font-semibold">${position.amount} ({position.leverage}x)</span>
                    <span className="text-sm text-muted-foreground">
                      Entrada: ${position.entryPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${pnl.toFixed(2)} ({pnlPercentage.toFixed(2)}%)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(position.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Historial de Posiciones */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Posiciones</CardTitle>
        </CardHeader>
        <CardContent>
          {positionHistory.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No hay historial de posiciones</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {positionHistory.map((position) => (
                <div key={`${position.id}-${position.timestamp}`} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={
                          position.status === 'closed' 
                            ? (position.pnl && position.pnl > 0 ? 'default' : 'destructive')
                            : 'secondary'
                        }
                      >
                        {position.type.toUpperCase()} - {position.status.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-semibold">
                        ${position.amount} ({position.leverage}x)
                      </span>
                    </div>
                    {position.pnl !== undefined && (
                      <Badge 
                        variant={position.pnl >= 0 ? 'default' : 'destructive'}
                      >
                        ${position.pnl.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Entrada: ${position.entryPrice.toFixed(2)} - {new Date(position.timestamp).toLocaleString()}</div>
                    {position.exitPrice && position.closedAt && (
                      <div>Salida: ${position.exitPrice.toFixed(2)} - {new Date(position.closedAt).toLocaleString()}</div>
                    )}
                    {position.reason && <div>Razón: {position.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                      ) : decision.action === "close" ? (
                        <div className="h-4 w-4 rounded-full bg-orange-400" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-gray-400" />
                      )}
                      <Badge
                        variant={
                          decision.action === "buy"
                            ? "default"
                            : decision.action === "sell"
                              ? "destructive"
                              : decision.action === "close"
                                ? "outline"
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
