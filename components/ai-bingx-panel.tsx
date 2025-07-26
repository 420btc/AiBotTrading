"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Bot, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react"

interface AIBingXPanelProps {
  apiKeys: { openai: string; bingxApiKey: string; bingxSecretKey: string }
  balance: number
  setBalance: React.Dispatch<React.SetStateAction<number>>
  positions: any[]
  setPositions: React.Dispatch<React.SetStateAction<any[]>>
}

interface AIRecommendation {
  action: "long" | "short" | "hold"
  confidence: number
  reasoning: string
  amount: number
  leverage: number
  entryPrice: number
  timeframeAnalysis?: {
    "15m": string
    "1h": string
    "4h": string
    "1d": string
  }
  volumeAnalysis?: string
  confluenceScore?: number
}

export function AIBingXPanel({ apiKeys, balance, setBalance, positions, setPositions }: AIBingXPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState<string>("")
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connected" | "error">("disconnected")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<AIRecommendation | null>(null)

  const MIN_POSITION_AMOUNT = 11.73 // Mínimo requerido por BingX
  const [maxPositionValue, setMaxPositionValue] = useState(15) // Mínimo 11.73 USDT según BingX
  const [selectedLeverage, setSelectedLeverage] = useState(1)
  const [aiRecommendedLeverage, setAiRecommendedLeverage] = useState(1)

  // Función para calcular precio de liquidación
  const calculateLiquidationPrice = (entryPrice: number, leverage: number, side: string) => {
    // Para posición LONG: Precio de liquidación = Precio de entrada * (1 - 1/leverage)
    // Para posición SHORT: Precio de liquidación = Precio de entrada * (1 + 1/leverage)
    if (side === "long") {
      return entryPrice * (1 - 1/leverage)
    } else {
      return entryPrice * (1 + 1/leverage)
    }
  }

  // Verificar conexión al cargar el componente
  useEffect(() => {
    checkConnection()
  }, [apiKeys])

  const checkConnection = async () => {
    if (!apiKeys.bingxApiKey || !apiKeys.bingxSecretKey) {
      setConnectionStatus("disconnected")
      return
    }

    try {
      const response = await fetch("/api/test-bingx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          apiKey: apiKeys.bingxApiKey,
          secretKey: apiKeys.bingxSecretKey
        }),
      })

      if (response.ok) {
        setConnectionStatus("connected")
      } else {
        setConnectionStatus("error")
      }
    } catch (error) {
      setConnectionStatus("error")
    }
  }

  const analyzeMarket = async () => {
    if (!apiKeys.openai) {
      alert("Por favor configura tu API key de OpenAI primero")
      return
    }

    if (connectionStatus !== "connected") {
      alert("Por favor configura y verifica tu conexión con BingX primero")
      return
    }

    setIsAnalyzing(true)
    setAiRecommendation(null)

    try {
      // Obtener datos del mercado de Bitcoin
      const priceResponse = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
      const priceData = await priceResponse.json()

      const currentPrice = parseFloat(priceData.lastPrice)
      const priceChange = parseFloat(priceData.priceChangePercent)
      const volume = parseFloat(priceData.volume)

      // Simular indicadores técnicos (en una implementación real vendrían del gráfico)
      const indicators = {
        rsi: Math.random() * 40 + 30, // RSI entre 30-70
        macd: {
          value: Math.random() * 200 - 100,
          signal: Math.random() * 200 - 100,
          histogram: Math.random() * 50 - 25
        },
        ema10: currentPrice * (0.998 + Math.random() * 0.004),
        ema55: currentPrice * (0.995 + Math.random() * 0.01),
        ema200: currentPrice * (0.99 + Math.random() * 0.02),
        volume: volume
      }

      const marketData = {
        price: currentPrice,
        priceChange: priceChange,
        indicators: indicators,
        balance: balance,
        activePositions: positions.length,
        maxAmount: maxPositionValue,
        minAmount: MIN_POSITION_AMOUNT
      }

      // Llamar a OpenAI para análisis
      const aiAnalysis = await callOpenAI(marketData)
      setAiRecommendation(aiAnalysis)
      setLastAnalysis(new Date().toLocaleTimeString())

    } catch (error) {
      console.error("Error en análisis de IA:", error)
      alert("Error al analizar el mercado")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const callOpenAI = async (marketData: any): Promise<AIRecommendation> => {
    const prompt = `
    Eres un trader experto de Bitcoin. Analiza los siguientes datos de mercado y recomienda una posición:

    Precio actual: $${marketData.price}
    Cambio 24h: ${marketData.priceChange}%
    RSI: ${marketData.indicators.rsi.toFixed(2)}
    MACD: ${marketData.indicators.macd.value.toFixed(2)} (Señal: ${marketData.indicators.macd.signal.toFixed(2)})
    EMA10: $${marketData.indicators.ema10.toFixed(2)}
    EMA55: $${marketData.indicators.ema55.toFixed(2)}
    EMA200: $${marketData.indicators.ema200.toFixed(2)}
    Volumen: ${marketData.indicators.volume}
    Balance disponible: $${marketData.balance}
    Posiciones activas: ${marketData.activePositions}
    
    ANÁLISIS TÉCNICO MULTI-TIMEFRAME REQUERIDO:
    
    TIMEFRAMES A ANALIZAR:
    - 15 minutos: Analiza las últimas 10 velas para detectar movimientos agresivos
    - 1 hora: Tendencia de corto plazo y momentum
    - 4 horas: Tendencia de medio plazo
    - 1 día: Tendencia de largo plazo
    
    INDICADORES POR TIMEFRAME:
    - RSI (14) en cada timeframe
    - MACD en 1h, 4h y 1d
    - Medias móviles (20, 50, 200) en cada timeframe
    - Volumen: Analiza si hay aumento/disminución significativa
    - Velas agresivas en 15m: Detecta si las últimas velas tienen cuerpos grandes (>2% del precio)
    
    ANÁLISIS DE CONFLUENCIA:
    - Verifica si 1h, 4h y 1d están alineados (todos alcistas o bajistas)
    - Considera el volumen: Mayor volumen = mayor confianza en la señal
    - Velas agresivas en 15m pueden indicar continuación o reversión
    
    REGLAS IMPORTANTES:
    - Mínimo a invertir: $${marketData.minAmount} USDT (requerido por BingX)
    - Máximo a invertir: $${marketData.maxAmount} USDT
    - Solo recomienda LONG o SHORT, nunca HOLD
    - Apalancamiento recomendado: 1x-125x (considera volatilidad)
    - Confianza mínima del 70%
    - Mayor peso a confluencia de timeframes
    - Volumen debe confirmar la dirección

    Responde en formato JSON:
    {
      "action": "long|short",
      "confidence": 85,
      "amount": 15,
      "leverage": 10,
      "reasoning": "Explicación detallada de la decisión basada en indicadores técnicos",
      "entryPrice": "${marketData.price}",
      "timeframeAnalysis": {
        "15m": "Análisis de 15 minutos",
        "1h": "Análisis de 1 hora",
        "4h": "Análisis de 4 horas",
        "1d": "Análisis de 1 día"
      },
      "volumeAnalysis": "Análisis del volumen",
      "confluenceScore": 8
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
      const analysis = JSON.parse(result.analysis)
      
      // Guardar el apalancamiento recomendado por la IA
      setAiRecommendedLeverage(Math.max(1, Math.min(analysis.leverage, 125)))
      
      return {
        action: analysis.action,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        amount: Math.max(MIN_POSITION_AMOUNT, Math.min(analysis.amount, maxPositionValue)),
        leverage: selectedLeverage, // Usar el apalancamiento seleccionado por el usuario
        entryPrice: marketData.price,
        timeframeAnalysis: analysis.timeframeAnalysis,
        volumeAnalysis: analysis.volumeAnalysis,
        confluenceScore: analysis.confluenceScore
      }
    } catch (error) {
      console.error("Error llamando a OpenAI:", error)
      throw error
    }
  }

  const handleExecuteOrder = (recommendation: AIRecommendation) => {
    setPendingOrder(recommendation)
    setShowConfirmDialog(true)
  }

  const confirmExecuteOrder = async () => {
    if (!pendingOrder) return

    setIsExecuting(true)
    setShowConfirmDialog(false)

    try {
      const totalCost = pendingOrder.amount / pendingOrder.leverage
      
      if (totalCost > balance) {
        alert("Fondos insuficientes")
        return
      }

      if (pendingOrder.amount < MIN_POSITION_AMOUNT) {
        alert("El monto mínimo para abrir una orden es 11.73 USDT")
        return
      }

      // Ejecutar orden real en BingX
      const orderResponse = await fetch("/api/bingx-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKeys.bingxApiKey,
          secretKey: apiKeys.bingxSecretKey,
          symbol: "BTC-USDT",
          side: pendingOrder.action === "long" ? "BUY" : "SELL",
          type: "MARKET",
          quantity: (pendingOrder.amount / pendingOrder.entryPrice).toFixed(6),
          leverage: pendingOrder.leverage
        }),
      })

      const orderResult = await orderResponse.json()

      if (!orderResponse.ok) {
        throw new Error(orderResult.error || "Error al ejecutar la orden")
      }

      // Si la orden se ejecutó exitosamente, agregar a posiciones
      const newPosition = {
        id: orderResult.orderId || Date.now().toString(),
        type: pendingOrder.action,
        amount: pendingOrder.amount,
        entryPrice: pendingOrder.entryPrice,
        leverage: pendingOrder.leverage,
        timestamp: Date.now(),
        isAI: true,
        exchange: "BingX",
        status: "open",
        orderId: orderResult.orderId
      }

      setPositions(prev => [...prev, newPosition])
      setBalance(prev => prev - totalCost)
      
      alert(`Posición ${pendingOrder.action.toUpperCase()} ejecutada exitosamente en BingX\nID de orden: ${orderResult.orderId}`)
      
    } catch (error) {
      console.error("Error ejecutando orden:", error)
      alert(`Error al ejecutar la orden: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setIsExecuting(false)
      setPendingOrder(null)
    }
  }

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Conectado</Badge>
      case "error":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>
      default:
        return <Badge variant="secondary">Desconectado</Badge>
    }
  }

  return (
    <div className="p-4 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5" />
          <span className="font-semibold">IA Trading - BingX</span>
          {getConnectionStatusBadge()}
        </div>
        <Button 
          onClick={analyzeMarket} 
          disabled={isAnalyzing || connectionStatus !== "connected"}
          size="sm"
        >
          {isAnalyzing ? "Analizando..." : "Analizar IA"}
        </Button>
      </div>

      <div className="space-y-4">
        {connectionStatus !== "connected" && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Configura tus API Keys de BingX en la sección de Configuración para usar esta funcionalidad.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-6 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium">Monto Máximo</label>
            <input
              type="number"
              min={MIN_POSITION_AMOUNT}
              max="100"
              step="0.01"
              value={maxPositionValue}
              onChange={(e) => setMaxPositionValue(Math.max(MIN_POSITION_AMOUNT, parseFloat(e.target.value) || MIN_POSITION_AMOUNT))}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Apalancamiento</label>
            <select
               value={selectedLeverage}
               onChange={(e) => setSelectedLeverage(parseInt(e.target.value))}
               className="w-full px-2 py-1 text-sm border rounded bg-background"
             >
               {[1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 125].map(lev => (
                 <option key={lev} value={lev}>{lev}x</option>
               ))}
             </select>
          </div>
          <div className="text-xs text-muted-foreground">
            <div>Min: <span className="text-orange-500">${MIN_POSITION_AMOUNT}</span></div>
            <div>Max: <span className="text-green-500">${maxPositionValue}</span></div>
          </div>
          <div className="text-xs text-muted-foreground">
            <div>Usuario: <span className="text-blue-500">{selectedLeverage}x</span></div>
            <div>IA: <span className="text-purple-500">{aiRecommendedLeverage}x</span></div>
          </div>
          <div className="text-xs text-muted-foreground">
            {lastAnalysis && (
              <div>Último: {lastAnalysis}</div>
            )}
          </div>
          <div>
            {connectionStatus !== "connected" && (
              <div className="text-xs text-red-500">⚠️ Configura API Keys</div>
            )}
          </div>
        </div>

        {aiRecommendation && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {aiRecommendation.action === "long" ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="font-semibold">Recomendación: {aiRecommendation.action.toUpperCase()}</span>
                <Badge variant="outline">{aiRecommendation.confidence}%</Badge>
              </div>
              <Button 
                onClick={() => handleExecuteOrder(aiRecommendation)}
                size="sm"
                className={`${
                  aiRecommendation.action === "long" 
                    ? "bg-green-600 hover:bg-green-700" 
                    : "bg-red-600 hover:bg-red-700"
                }`}
                disabled={isExecuting || aiRecommendation.confidence < 70}
              >
                {isExecuting ? "Ejecutando..." : `Ejecutar ${aiRecommendation.action.toUpperCase()}`}
              </Button>
            </div>
            
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2 space-y-1 text-xs">
                <div><span className="text-muted-foreground">Cantidad:</span> <span className="font-semibold">${aiRecommendation.amount}</span></div>
                <div><span className="text-muted-foreground">Apalancamiento:</span> <span className="font-semibold">{aiRecommendation.leverage}x</span></div>
              </div>
              <div className="col-span-2 space-y-1 text-xs">
                <div><span className="text-muted-foreground">Entrada:</span> <span className="font-semibold">${aiRecommendation.entryPrice.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Liquidación:</span> <span className="font-semibold text-red-500">${calculateLiquidationPrice(aiRecommendation.entryPrice, aiRecommendation.leverage, aiRecommendation.action).toFixed(2)}</span></div>
              </div>

              <div className="col-span-4">
                <div className="text-xs text-muted-foreground mb-1">Análisis General:</div>
                <div className="text-xs bg-background p-2 rounded border max-h-16 overflow-y-auto">
                  {aiRecommendation.reasoning}
                </div>
              </div>
                
              {aiRecommendation.timeframeAnalysis && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Timeframes:</div>
                  <div className="space-y-1 text-xs">
                    <div><span className="font-semibold">15m:</span> {aiRecommendation.timeframeAnalysis["15m"]}</div>
                    <div><span className="font-semibold">1h:</span> {aiRecommendation.timeframeAnalysis["1h"]}</div>
                  </div>
                </div>
              )}
                
              {aiRecommendation.volumeAnalysis && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Volumen:</div>
                  <div className="text-xs bg-background p-2 rounded border max-h-16 overflow-y-auto">
                    {aiRecommendation.volumeAnalysis}
                  </div>
                </div>
              )}
                
              {aiRecommendation.confluenceScore && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Confluencia:</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-xs font-semibold">{aiRecommendation.confluenceScore}/10</div>
                    <div className="flex-1 bg-muted rounded-full h-1">
                      <div 
                        className="bg-blue-500 h-1 rounded-full transition-all" 
                        style={{ width: `${(aiRecommendation.confluenceScore / 10) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {aiRecommendation.confidence < 70 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Confianza baja ({aiRecommendation.confidence}%). Se requiere mínimo 70% para ejecutar.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Operación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres ejecutar esta operación?
              <br /><br />
              <strong>Tipo:</strong> {pendingOrder?.action.toUpperCase()}<br />
              <strong>Cantidad:</strong> ${pendingOrder?.amount} USDT<br />
              <strong>Apalancamiento:</strong> {pendingOrder?.leverage}x<br />
              <strong>Costo total:</strong> ${pendingOrder ? (pendingOrder.amount / pendingOrder.leverage).toFixed(2) : 0} USDT<br />
              <strong>Exchange:</strong> BingX<br />
              <br />
              Esta operación se ejecutará con dinero real.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExecuteOrder}>
              Confirmar Ejecución
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default AIBingXPanel
