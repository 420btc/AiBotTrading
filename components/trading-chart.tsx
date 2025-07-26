"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bot, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TradingChartProps {
  apiKeys: { openai: string }
  balance: number
  setBalance: React.Dispatch<React.SetStateAction<number>>
  positions: any[]
  setPositions: React.Dispatch<React.SetStateAction<any[]>>
}

export function TradingChart({ apiKeys, balance, setBalance, positions, setPositions }: TradingChartProps) {
  const tradingViewRef = useRef<HTMLDivElement>(null)
  const [currentPrice, setCurrentPrice] = useState(0)

  // Estados de IA
  const [isAIActive, setIsAIActive] = useState(false)
  const [aiDecisions, setAIDecisions] = useState<any[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState("")
  const [maxPositionSize, setMaxPositionSize] = useState("100")
  const [aiStatus, setAiStatus] = useState("Inactivo")
  const [apiError, setApiError] = useState<string | null>(null)
  const [lastAIPositionTime, setLastAIPositionTime] = useState<number>(0)

  // Conectar a Binance WebSocket para obtener precio actual
  useEffect(() => {
    let ws: WebSocket | null = null

    try {
      ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker")

      ws.onopen = () => {
        console.log("WebSocket conectado")
        setApiError(null)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (!data || !data.c) {
            console.warn("Datos de WebSocket inválidos:", data)
            return
          }

          const closePrice = Number.parseFloat(data.c)
          if (!isNaN(closePrice) && isFinite(closePrice)) {
            setCurrentPrice(closePrice)
          }
        } catch (error) {
          console.error("Error procesando mensaje de WebSocket:", error)
        }
      }

      ws.onerror = (error) => {
        console.error("Error de WebSocket:", error)
        setApiError("Error de conexión con Binance")
      }

      ws.onclose = () => {
        console.log("WebSocket desconectado")
      }
    } catch (error) {
      console.error("Error inicializando WebSocket:", error)
      setApiError("Error inicializando conexión con Binance")
    }

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  // Cargar widget de TradingView
  useEffect(() => {
    if (!tradingViewRef.current) return

    // Limpiar el contenedor
    tradingViewRef.current.innerHTML = ''

    // Crear el script de TradingView
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": "BINANCE:BTCUSDT",
      "interval": "15",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "es",
      "enable_publishing": false,
      "allow_symbol_change": true,
      "calendar": false,
      "support_host": "https://www.tradingview.com",
      "studies": [
        "MACD@tv-basicstudies",
        "RSI@tv-basicstudies",
        {
          "id": "MAExp@tv-basicstudies",
          "inputs": {"length": 10}
        },
        {
          "id": "MAExp@tv-basicstudies",
          "inputs": {"length": 55}
        },
        {
          "id": "MAExp@tv-basicstudies",
          "inputs": {"length": 200}
        },
        {
          "id": "MAExp@tv-basicstudies",
          "inputs": {"length": 365}
        }
      ],
      "studies_overrides": {
        "MACD.macd": "#2196F3",
        "MACD.signal": "#FF9800",
        "MACD.histogram": "#4CAF50",
        "RSI.RSI": "#9C27B0",
        "MAExp.Plot": "#FF5722",
        "MAExp.Plot.1": "#00BCD4",
        "MAExp.Plot.2": "#FFC107",
        "MAExp.Plot.3": "#E91E63"
      },
      "overrides": {
        "paneProperties.background": "#131722",
        "paneProperties.vertGridProperties.color": "#363c4e",
        "paneProperties.horzGridProperties.color": "#363c4e",
        "symbolWatermarkProperties.transparency": 90,
        "scalesProperties.textColor": "#AAA",
        "mainSeriesProperties.candleStyle.upColor": "#26a69a",
        "mainSeriesProperties.candleStyle.downColor": "#ef5350",
        "mainSeriesProperties.candleStyle.borderUpColor": "#26a69a",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ef5350",
        "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350"
      }
    })

    tradingViewRef.current.appendChild(script)
  }, [])



  const analyzeMarket = async () => {
    if (!apiKeys.openai) {
      setApiError("API key de OpenAI no configurada")
      return
    }

    if (!currentPrice || currentPrice <= 0) {
      setApiError("No hay datos de precio disponibles")
      return
    }

    // Verificar tiempo mínimo entre análisis (5 minutos)
    const now = Date.now()
    if (now - lastAIPositionTime < 300000) {
      const remainingTime = Math.ceil((300000 - (now - lastAIPositionTime)) / 1000)
      setAiStatus(`⏳ Esperando ${remainingTime}s...`)
      return
    }

    setAiStatus("🤖 Analizando mercado...")

    try {
      // Obtener datos de mercado de Binance para múltiples timeframes
      const [tickerResponse, klines15m, klines1h, klines4h, klines1d] = await Promise.all([
        fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
        fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=100"),
        fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100"),
        fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=100"),
        fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=100")
      ])

      const tickerData = await tickerResponse.json()
      const klines15mData = await klines15m.json()
      const klines1hData = await klines1h.json()
      const klines4hData = await klines4h.json()
      const klines1dData = await klines1d.json()

      // Función para calcular RSI
      const calculateRSI = (prices: number[], period = 14) => {
        if (prices.length < period + 1) return 50
        
        let gains = 0, losses = 0
        for (let i = 1; i <= period; i++) {
          const change = prices[prices.length - i] - prices[prices.length - i - 1]
          if (change > 0) gains += change
          else losses -= change
        }
        
        const avgGain = gains / period
        const avgLoss = losses / period
        const rs = avgGain / avgLoss
        return 100 - (100 / (1 + rs))
      }

      // Función para calcular EMA
      const calculateEMA = (prices: number[], period: number) => {
        if (prices.length < period) return prices[prices.length - 1]
        
        const multiplier = 2 / (period + 1)
        let ema = prices.slice(0, period).reduce((a, b) => a + b) / period
        
        for (let i = period; i < prices.length; i++) {
          ema = (prices[i] * multiplier) + (ema * (1 - multiplier))
        }
        return ema
      }

      // Procesar datos de cada timeframe
      const processTimeframeData = (klines: any[], timeframe: string) => {
        const closes = klines.map(k => parseFloat(k[4]))
        const volumes = klines.map(k => parseFloat(k[5]))
        const highs = klines.map(k => parseFloat(k[2]))
        const lows = klines.map(k => parseFloat(k[3]))
        
        return {
          timeframe,
          rsi: calculateRSI(closes),
          ema20: calculateEMA(closes, 20),
          ema50: calculateEMA(closes, 50),
          ema200: calculateEMA(closes, 200),
          currentPrice: closes[closes.length - 1],
          volume: volumes[volumes.length - 1],
          avgVolume: volumes.slice(-20).reduce((a, b) => a + b) / 20,
          priceChange: ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100,
          high: highs[highs.length - 1],
          low: lows[lows.length - 1]
        }
      }

      const timeframeData = {
        '15m': processTimeframeData(klines15mData, '15m'),
        '1h': processTimeframeData(klines1hData, '1h'),
        '4h': processTimeframeData(klines4hData, '4h'),
        '1d': processTimeframeData(klines1dData, '1d')
      }

      const marketData = {
        currentPrice: currentPrice,
        priceChange24h: Number.parseFloat(tickerData.priceChangePercent) || 0,
        high24h: Number.parseFloat(tickerData.highPrice) || currentPrice,
        low24h: Number.parseFloat(tickerData.lowPrice) || currentPrice,
        volume24h: Number.parseFloat(tickerData.volume) || 0,
        timeframes: timeframeData,
        account: {
          balance: balance,
          activePositions: positions.length,
          maxPositionSize: Number.parseFloat(maxPositionSize) || 100,
          riskLevel: balance > 400 ? "conservative" : balance > 200 ? "moderate" : "aggressive",
        },
        timestamp: new Date().toISOString(),
        marketSession: new Date().getHours() >= 9 && new Date().getHours() <= 16 ? "active" : "quiet",
      }

      console.log("Enviando datos multi-timeframe a IA:", marketData)

      const aiAnalysis = await callOpenAI(marketData)
      setCurrentAnalysis(aiAnalysis.reasoning)
      setApiError(null)

      // SIEMPRE ejecutar la decisión de IA (crear posición)
      const executionResult = await executeAIDecision(aiAnalysis, currentPrice)

      const newDecision = {
        action: aiAnalysis.action,
        confidence: aiAnalysis.confidence,
        reasoning: aiAnalysis.reasoning,
        amount: aiAnalysis.amount,
        leverage: aiAnalysis.leverage,
        timestamp: Date.now(),
        executed: executionResult.success,
        positionId: executionResult.positionId,
        timeframeAnalysis: aiAnalysis.timeframeAnalysis || {},
        riskManagement: aiAnalysis.riskManagement || {},
        marketContext: aiAnalysis.marketContext || {},
        marketData: {
          price: currentPrice,
          trend: tickerData.priceChangePercent > 0 ? "bullish" : "bearish",
          rsi: timeframeData['1h'].rsi,
          optimalTimeframe: aiAnalysis.riskManagement?.optimalTimeframe || '1h',
          confluenceScore: aiAnalysis.marketContext?.confluenceScore || 5
        },
      }

      setAIDecisions((prev) => [newDecision, ...prev.slice(0, 9)])

      if (executionResult.success) {
        setAiStatus(`✅ Ejecutado: ${aiAnalysis.action.toUpperCase()} $${aiAnalysis.amount}`)
      } else {
        setAiStatus(`❌ Error: ${executionResult.error}`)
      }
    } catch (error) {
      console.error("Error en análisis de IA:", error)
      setAiStatus("Error en análisis")
      setApiError(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    }
  }

  const callOpenAI = async (marketData: any) => {
    // Obtener datos de posiciones actuales para análisis de liquidación
    const currentPositions = positions.map(pos => ({
      type: pos.type,
      amount: pos.amount,
      entryPrice: pos.entryPrice,
      leverage: pos.leverage,
      liquidationPrice: pos.type === 'long' 
        ? pos.entryPrice * (1 - 1/pos.leverage) 
        : pos.entryPrice * (1 + 1/pos.leverage),
      currentPnL: pos.type === 'long' 
        ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.leverage
        : ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100 * pos.leverage
    }));

    const prompt = `
  Eres un experto trader de Bitcoin con análisis técnico avanzado. Analiza TODOS los timeframes y proporciona un análisis completo:

  === DATOS DE MERCADO ACTUALES ===
  Precio actual: $${marketData.currentPrice}
  Cambio 24h: ${marketData.priceChange24h}%
  Máximo 24h: $${marketData.high24h}
  Mínimo 24h: $${marketData.low24h}
  Volumen 24h: ${marketData.volume24h} BTC

  === ANÁLISIS MULTI-TIMEFRAME ===
  📊 TIMEFRAME 15m:
  - RSI: ${marketData.timeframes['15m'].rsi.toFixed(2)}
  - EMA20: $${marketData.timeframes['15m'].ema20.toFixed(2)}
  - EMA50: $${marketData.timeframes['15m'].ema50.toFixed(2)}
  - Cambio: ${marketData.timeframes['15m'].priceChange.toFixed(2)}%
  - Volumen: ${marketData.timeframes['15m'].volume.toFixed(0)} vs Promedio: ${marketData.timeframes['15m'].avgVolume.toFixed(0)}

  📊 TIMEFRAME 1h:
  - RSI: ${marketData.timeframes['1h'].rsi.toFixed(2)}
  - EMA20: $${marketData.timeframes['1h'].ema20.toFixed(2)}
  - EMA50: $${marketData.timeframes['1h'].ema50.toFixed(2)}
  - EMA200: $${marketData.timeframes['1h'].ema200.toFixed(2)}
  - Cambio: ${marketData.timeframes['1h'].priceChange.toFixed(2)}%
  - Volumen: ${marketData.timeframes['1h'].volume.toFixed(0)} vs Promedio: ${marketData.timeframes['1h'].avgVolume.toFixed(0)}

  📊 TIMEFRAME 4h:
  - RSI: ${marketData.timeframes['4h'].rsi.toFixed(2)}
  - EMA20: $${marketData.timeframes['4h'].ema20.toFixed(2)}
  - EMA50: $${marketData.timeframes['4h'].ema50.toFixed(2)}
  - EMA200: $${marketData.timeframes['4h'].ema200.toFixed(2)}
  - Cambio: ${marketData.timeframes['4h'].priceChange.toFixed(2)}%
  - Volumen: ${marketData.timeframes['4h'].volume.toFixed(0)} vs Promedio: ${marketData.timeframes['4h'].avgVolume.toFixed(0)}

  📊 TIMEFRAME 1d:
  - RSI: ${marketData.timeframes['1d'].rsi.toFixed(2)}
  - EMA20: $${marketData.timeframes['1d'].ema20.toFixed(2)}
  - EMA50: $${marketData.timeframes['1d'].ema50.toFixed(2)}
  - EMA200: $${marketData.timeframes['1d'].ema200.toFixed(2)}
  - Cambio: ${marketData.timeframes['1d'].priceChange.toFixed(2)}%
  - Volumen: ${marketData.timeframes['1d'].volume.toFixed(0)} vs Promedio: ${marketData.timeframes['1d'].avgVolume.toFixed(0)}

  === POSICIONES ACTUALES ===
  ${currentPositions.length > 0 ? currentPositions.map(pos => 
    `${pos.type.toUpperCase()}: $${pos.amount} @ $${pos.entryPrice} (${pos.leverage}x) - Liquidación: $${pos.liquidationPrice.toFixed(2)} - PnL: ${pos.currentPnL.toFixed(2)}%`
  ).join('\n  ') : 'Sin posiciones abiertas'}

  === ESTADO DE CUENTA ===
  Balance: $${marketData.account.balance}
  Posiciones activas: ${marketData.account.activePositions}
  Tamaño máximo: $${marketData.account.maxPositionSize}
  Nivel de riesgo: ${marketData.account.riskLevel}

  === CONTEXTO TEMPORAL ===
  Sesión de mercado: ${marketData.marketSession}
  Timestamp: ${marketData.timestamp}

  INSTRUCCIONES CRÍTICAS:
  1. NUNCA respondas "hold" - SIEMPRE elige "buy" o "sell"
  2. Analiza TODOS los timeframes (15m, 1h, 4h, 1d) proporcionados
  3. Evalúa riesgo de liquidación de posiciones existentes basado en apalancamiento
  4. Considera confluencia de indicadores entre timeframes (RSI, EMAs, volumen)
  5. Recomienda timeframe óptimo para la operación
  6. Evalúa si el volumen actual vs promedio confirma la señal
  7. Esta decisión CREARÁ una posición automáticamente

  Responde SOLO en formato JSON con la estructura EXACTA del nuevo sistema:
  {
    "action": "buy",
    "confidence": 75,
    "amount": 80,
    "leverage": 3,
    "reasoning": "Análisis detallado...",
    "timeframeAnalysis": {
      "15m": {
        "trend": "bullish",
        "rsi": 65,
        "ema20": 49800,
        "volume": "high",
        "signal": "strong_buy"
      },
      "1h": {
        "trend": "bullish",
        "rsi": 58,
        "macd": "bullish_cross",
        "ema50": 49500,
        "signal": "buy"
      },
      "4h": {
        "trend": "neutral",
        "rsi": 52,
        "ema200": 48000,
        "signal": "neutral"
      },
      "1d": {
        "trend": "bullish",
        "rsi": 60,
        "signal": "buy"
      }
    },
    "riskManagement": {
      "liquidationRisk": "low",
      "optimalTimeframe": "1h",
      "stopLoss": 48500,
      "takeProfit": 51000
    },
    "marketContext": {
      "confluenceScore": 8,
      "volumeProfile": "increasing",
      "marketStructure": "uptrend"
    }
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
        throw new Error(`Error en la respuesta de OpenAI: ${response.status}`)
      }

      const result = await response.json()

      if (!result || !result.analysis) {
        throw new Error("Respuesta de OpenAI inválida")
      }

      let aiDecision
      try {
        aiDecision = JSON.parse(result.analysis)
      } catch (e) {
        throw new Error("Error al parsear respuesta JSON de OpenAI")
      }

      // Validar que la decisión no sea hold
      if (!aiDecision.action || aiDecision.action === "hold") {
        aiDecision.action = marketData.trends.emaAlignment ? "buy" : "sell"
        aiDecision.reasoning += " (Decisión forzada: no se permite hold)"
      }

      // Asegurar confianza mínima
      if (!aiDecision.confidence || aiDecision.confidence < 65) {
        aiDecision.confidence = 65
      }

      // Validar otros campos
      if (!aiDecision.amount || isNaN(aiDecision.amount)) {
        aiDecision.amount = Math.min(Number.parseFloat(maxPositionSize) || 50, balance * 0.2)
      }

      if (!aiDecision.leverage || isNaN(aiDecision.leverage)) {
        aiDecision.leverage = 2
      }

      if (!aiDecision.reasoning) {
        aiDecision.reasoning = "Análisis basado en indicadores técnicos actuales."
      }

      return aiDecision
    } catch (error) {
      console.error("Error llamando a OpenAI:", error)
      // Fallback simple basado en precio
      const priceChange = marketData.priceChange24h
      const fallbackAction = priceChange > 0 ? "buy" : "sell"
      const confidence = Math.min(Math.max(65, 65 + Math.abs(priceChange) * 2), 85)

      return {
        action: fallbackAction,
        confidence: confidence,
        amount: Math.min(Number.parseFloat(maxPositionSize) || 50, balance * 0.2),
        leverage: marketData.account.riskLevel === "conservative" ? 2 : 3,
        reasoning: `Análisis automático: Cambio 24h ${priceChange}%. ${fallbackAction === "buy" ? "Tendencia alcista" : "Tendencia bajista"}.`,
      }
    }
  }

  // Función MEJORADA para ejecutar decisión de IA - SIEMPRE crea posición
  const executeAIDecision = async (decision: any, currentPrice: number) => {
    try {
      if (!decision.action || (decision.action !== "buy" && decision.action !== "sell")) {
        return { success: false, error: "Acción inválida", positionId: null }
      }

      // Verificar límite de tiempo de 5 minutos (300000 ms)
      const currentTime = Date.now()
      const timeSinceLastPosition = currentTime - lastAIPositionTime
      const fiveMinutes = 5 * 60 * 1000 // 5 minutos en milisegundos
      
      if (timeSinceLastPosition < fiveMinutes && lastAIPositionTime > 0) {
        const remainingTime = Math.ceil((fiveMinutes - timeSinceLastPosition) / 1000)
        return { 
          success: false, 
          error: `Debe esperar ${remainingTime}s antes de la próxima posición IA`, 
          positionId: null 
        }
      }

      // Validar datos
      const amount = Number(decision.amount)
      const leverage = Number(decision.leverage)

      if (isNaN(amount) || amount <= 0) {
        return { success: false, error: "Cantidad inválida", positionId: null }
      }

      if (isNaN(leverage) || leverage <= 0) {
        return { success: false, error: "Apalancamiento inválido", positionId: null }
      }

      const totalCost = amount / leverage

      if (isNaN(totalCost) || totalCost <= 0) {
        return { success: false, error: "Costo total inválido", positionId: null }
      }

      if (totalCost > balance) {
        // Si no hay suficiente balance, usar el máximo disponible
        const maxAmount = balance * leverage * 0.9 // Usar 90% del balance disponible
        if (maxAmount < 10) {
          return { success: false, error: "Balance insuficiente (mínimo $10)", positionId: null }
        }

        // Ajustar la cantidad
        decision.amount = maxAmount
      }

      const finalCost = decision.amount / leverage
      const positionId = Date.now().toString()

      const newPosition = {
        id: positionId,
        type: decision.action === "buy" ? "long" : "short",
        amount: decision.amount,
        entryPrice: currentPrice,
        leverage: leverage,
        timestamp: Date.now(),
        isAI: true,
        aiReasoning: decision.reasoning,
        confidence: decision.confidence,
      }

      // Actualizar posiciones y balance
      setPositions((prev: any[]) => [...prev, newPosition])
      setBalance((prev: number) => prev - finalCost)
      setLastAIPositionTime(Date.now()) // Actualizar tiempo de última posición IA

      console.log(`🤖 IA ejecutó: ${decision.action.toUpperCase()} $${decision.amount} BTC a $${currentPrice}`)
      console.log(`💰 Costo: $${finalCost.toFixed(2)} | Balance restante: $${(balance - finalCost).toFixed(2)}`)

      return { success: true, error: null, positionId: positionId }
    } catch (error) {
      console.error("Error ejecutando decisión de IA:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        positionId: null,
      }
    }
  }

  // Análisis automático de IA
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isAIActive && apiKeys.openai) {
      // Análisis inicial inmediato
      analyzeMarket()
      // Luego cada 5 minutos
      interval = setInterval(analyzeMarket, 300000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAIActive, apiKeys.openai])



  return (
    <Card className="h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">BTC/USDT - 1m</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-green-500">
            ${currentPrice > 0 ? currentPrice.toFixed(2) : "--"}
          </Badge>

        </div>
      </div>

      {apiError && (
        <div className="mb-4 p-2 bg-red-50 text-red-600 rounded-md flex items-center text-sm">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <span>{apiError}</span>
        </div>
      )}

      <div 
        ref={tradingViewRef}
        className="w-full border rounded"
        style={{ height: "400px" }}
      >
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Cargando gráfico de TradingView...
        </div>
      </div>

      {/* Panel de IA integrado - VERSIÓN COMPLETA */}
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Control de IA */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Bot className="h-5 w-5" />
                  <span>Bot IA</span>
                </span>
                <Badge variant={isAIActive ? "default" : "secondary"}>{aiStatus}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setIsAIActive(!isAIActive)}
                  variant={isAIActive ? "destructive" : "default"}
                  className="flex-1"
                >
                  {isAIActive ? "Detener Bot" : "Iniciar Bot"}
                </Button>
                <Button onClick={analyzeMarket} disabled={!apiKeys.openai || isAIActive} variant="outline" size="sm">
                  Analizar
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Tamaño Máximo ($)</Label>
                <Input
                  type="number"
                  value={maxPositionSize}
                  onChange={(e) => setMaxPositionSize(e.target.value)}
                  placeholder="100"
                />
              </div>

              <div className="text-xs text-blue-600 p-2 bg-blue-50 rounded">
                ℹ️ Cada análisis crea automáticamente una posición
              </div>

              {!apiKeys.openai && (
                <div className="text-xs text-red-500 p-2 bg-red-50 rounded">
                  ⚠️ Configura tu API key de OpenAI en Configuración
                </div>
              )}
            </CardContent>
          </Card>

          {/* Última Decisión */}
          <Card>
            <CardHeader>
              <CardTitle>Última Decisión</CardTitle>
            </CardHeader>
            <CardContent>
              {aiDecisions.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={aiDecisions[0].action === "buy" ? "default" : "destructive"}
                      className={`flex items-center space-x-1 ${aiDecisions[0].action === "buy" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
                    >
                      {aiDecisions[0].action === "buy" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{aiDecisions[0].action.toUpperCase()}</span>
                    </Badge>
                    <Badge variant="outline">{aiDecisions[0].confidence}%</Badge>
                  </div>
                  <div className="text-sm">
                    <strong>${aiDecisions[0].amount}</strong> con <strong>{aiDecisions[0].leverage}x</strong>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={aiDecisions[0].executed ? "default" : "destructive"} className="text-xs">
                      {aiDecisions[0].executed ? "✅ Ejecutado" : "❌ Error"}
                    </Badge>
                    {aiDecisions[0].positionId && (
                      <Badge variant="outline" className="text-xs">
                        ID: {aiDecisions[0].positionId.slice(-4)}
                      </Badge>
                    )}
                  </div>
                  {aiDecisions[0].marketData && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Precio: ${aiDecisions[0].marketData.price ? aiDecisions[0].marketData.price.toFixed(2) : "--"} | RSI 1h:{" "}
                        {aiDecisions[0].marketData.rsi ? aiDecisions[0].marketData.rsi.toFixed(1) : "--"} | Tendencia: {aiDecisions[0].marketData.trend || "--"}
                      </div>
                      {aiDecisions[0].riskManagement && (
                        <div className="text-xs text-blue-600">
                          🎯 Timeframe óptimo: {aiDecisions[0].riskManagement.optimalTimeframe || "--"} | 
                          Riesgo liquidación: {aiDecisions[0].riskManagement.liquidationRisk || "--"}
                        </div>
                      )}
                      {aiDecisions[0].marketContext && (
                        <div className="text-xs text-green-600">
                          📊 Confluencia: {aiDecisions[0].marketContext.confluenceScore || "--"}/10 | 
                          Estructura: {aiDecisions[0].marketContext.marketStructure || "--"}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(aiDecisions[0].timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Inicia el bot para ver análisis</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Análisis Detallado */}
          <Card>
            <CardHeader>
              <CardTitle>Análisis IA</CardTitle>
            </CardHeader>
            <CardContent>
              {currentAnalysis ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto">{currentAnalysis}</div>
                  <div className="text-xs text-muted-foreground">Actualizado: {new Date().toLocaleTimeString()}</div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-sm">Esperando análisis...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Historial de Decisiones del Bot */}
        {aiDecisions.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Historial del Bot (Últimas 5 decisiones)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {aiDecisions.slice(1, 6).map((decision, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                    <div className="flex items-center space-x-2">
                      <Badge variant={decision.action === "buy" ? "default" : "destructive"} className={`text-xs ${decision.action === "buy" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                        {decision.action.toUpperCase()}
                      </Badge>
                      <span>
                        ${decision.amount} ({decision.leverage}x)
                      </span>
                      <Badge variant={decision.executed ? "default" : "destructive"} className="text-xs">
                        {decision.executed ? "✅" : "❌"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {decision.confidence}% | {new Date(decision.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Card>
  )
}
