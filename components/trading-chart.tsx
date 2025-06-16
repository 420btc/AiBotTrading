"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bot, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Añadir las props necesarias para la IA
interface TradingChartProps {
  apiKeys: { openai: string }
  balance: number
  setBalance: React.Dispatch<React.SetStateAction<number>>
  positions: any[]
  setPositions: React.Dispatch<React.SetStateAction<any[]>>
}

interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Indicators {
  ema10: number[]
  ema55: number[]
  ema200: number[]
  ema365: number[]
  macd: { macd: number[]; signal: number[]; histogram: number[] }
  rsi: number[]
}

export function TradingChart({ apiKeys, balance, setBalance, positions, setPositions }: TradingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)
  const [indicators, setIndicators] = useState<Indicators>({
    ema10: [],
    ema55: [],
    ema200: [],
    ema365: [],
    macd: { macd: [], signal: [], histogram: [] },
    rsi: [],
  })
  const [showIndicators, setShowIndicators] = useState({
    ema10: true,
    ema55: true,
    ema200: true,
    ema365: false,
    macd: false,
    rsi: false,
    volume: true,
  })

  // Estados para navegación del gráfico
  const [chartOffset, setChartOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [lastMouseX, setLastMouseX] = useState(0)
  const [visibleCandleCount, setVisibleCandleCount] = useState(100)

  // Estados de IA
  const [isAIActive, setIsAIActive] = useState(false)
  const [aiDecisions, setAIDecisions] = useState<any[]>([])
  const [currentAnalysis, setCurrentAnalysis] = useState("")
  const [maxPositionSize, setMaxPositionSize] = useState("100")
  const [aiStatus, setAiStatus] = useState("Inactivo")
  const [apiError, setApiError] = useState<string | null>(null)
  const [lastAIPositionTime, setLastAIPositionTime] = useState<number>(0)

  // Conectar a Binance WebSocket para datos en tiempo real
  useEffect(() => {
    let ws: WebSocket | null = null

    try {
      ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m")

      ws.onopen = () => {
        console.log("WebSocket conectado")
        setApiError(null)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (!data || !data.k) {
            console.warn("Datos de WebSocket inválidos:", data)
            return
          }

          const kline = data.k

          if (kline.x) {
            // Vela cerrada
            const newCandle: Candle = {
              timestamp: kline.t,
              open: Number.parseFloat(kline.o) || 0,
              high: Number.parseFloat(kline.h) || 0,
              low: Number.parseFloat(kline.l) || 0,
              close: Number.parseFloat(kline.c) || 0,
              volume: Number.parseFloat(kline.v) || 0,
            }

            // Validar datos de la vela
            if (isNaN(newCandle.open) || isNaN(newCandle.high) || isNaN(newCandle.low) || isNaN(newCandle.close)) {
              console.warn("Datos de vela inválidos:", newCandle)
              return
            }

            setCandles((prev) => {
              const updated = [...prev.slice(-499), newCandle]
              calculateIndicators(updated)
              return updated
            })
          }

          const closePrice = Number.parseFloat(kline.c)
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

    // Obtener datos históricos
    fetchHistoricalData()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500")

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error("Formato de respuesta inválido")
      }

      const historicalCandles: Candle[] = data
        .map((kline: any[]) => {
          // Validar y convertir cada valor con valor predeterminado en caso de error
          const open = Number.parseFloat(kline[1]) || 0
          const high = Number.parseFloat(kline[2]) || 0
          const low = Number.parseFloat(kline[3]) || 0
          const close = Number.parseFloat(kline[4]) || 0
          const volume = Number.parseFloat(kline[5]) || 0

          return {
            timestamp: kline[0] || Date.now(),
            open,
            high,
            low,
            close,
            volume,
          }
        })
        .filter(
          (candle) =>
            // Filtrar velas con datos inválidos
            !isNaN(candle.open) && !isNaN(candle.high) && !isNaN(candle.low) && !isNaN(candle.close),
        )

      if (historicalCandles.length > 0) {
        setCandles(historicalCandles)
        calculateIndicators(historicalCandles)
        setApiError(null)
      } else {
        throw new Error("No se obtuvieron datos válidos")
      }
    } catch (error) {
      console.error("Error fetching historical data:", error)
      setApiError(`Error obteniendo datos históricos: ${error instanceof Error ? error.message : "Error desconocido"}`)
    }
  }

  // Modificar la función calculateEMA para evitar NaN
  const calculateEMA = (prices: number[], period: number): number[] => {
    if (!prices || prices.length === 0) return []

    const validPrices = prices.filter((price) => !isNaN(price) && isFinite(price))
    if (validPrices.length === 0) return []

    const ema = []
    const multiplier = 2 / (period + 1)

    ema[0] = validPrices[0]
    for (let i = 1; i < validPrices.length; i++) {
      const currentEMA: number = validPrices[i] * multiplier + ema[i - 1] * (1 - multiplier)
      ema[i] = isNaN(currentEMA) ? ema[i - 1] : currentEMA
    }

    return ema
  }

  // Modificar calculateRSI para evitar NaN
  const calculateRSI = (prices: number[], period = 14): number[] => {
    if (!prices || prices.length < period + 1) return []

    const validPrices = prices.filter((price) => !isNaN(price) && isFinite(price))
    if (validPrices.length < period + 1) return []

    const rsi = []
    const gains = []
    const losses = []

    for (let i = 1; i < validPrices.length; i++) {
      const change = validPrices[i] - validPrices[i - 1]
      gains.push(change > 0 ? change : 0)
      losses.push(change < 0 ? Math.abs(change) : 0)
    }

    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period

      if (avgLoss === 0 || isNaN(avgLoss)) {
        rsi.push(100)
      } else {
        const rs = avgGain / avgLoss
        const rsiValue = 100 - 100 / (1 + rs)
        rsi.push(isNaN(rsiValue) ? 50 : rsiValue)
      }
    }

    return rsi
  }

  const calculateMACD = (prices: number[]): { macd: number[]; signal: number[]; histogram: number[] } => {
    const ema12 = calculateEMA(prices, 12)
    const ema26 = calculateEMA(prices, 26)
    const macd = ema12.map((val, i) => val - ema26[i])
    const signal = calculateEMA(macd, 9)
    const histogram = macd.map((val, i) => val - signal[i])

    return { macd, signal, histogram }
  }

  const calculateIndicators = (candleData: Candle[]) => {
    if (!candleData || candleData.length === 0) return

    try {
      const closePrices = candleData.map((c) => c.close).filter((price) => !isNaN(price) && isFinite(price))

      if (closePrices.length === 0) {
        console.warn("No hay precios válidos para calcular indicadores")
        return
      }

      const newIndicators: Indicators = {
        ema10: calculateEMA(closePrices, 10),
        ema55: calculateEMA(closePrices, 55),
        ema200: calculateEMA(closePrices, 200),
        ema365: calculateEMA(closePrices, 365),
        macd: calculateMACD(closePrices),
        rsi: calculateRSI(closePrices),
      }

      setIndicators(newIndicators)
    } catch (error) {
      console.error("Error calculando indicadores:", error)
    }
  }

  const analyzeMarket = async () => {
    if (!apiKeys.openai) {
      alert("Por favor configura tu API key de OpenAI primero")
      return
    }

    setAiStatus("Analizando...")

    try {
      // Obtener datos completos del mercado
      const [priceResponse, klineResponse] = await Promise.all([
        fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
        fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100"),
      ])

      if (!priceResponse.ok || !klineResponse.ok) {
        throw new Error("Error obteniendo datos de mercado")
      }

      const priceData = await priceResponse.json()
      const klineData = await klineResponse.json()

      // Validar datos recibidos
      if (!priceData || !klineData || !Array.isArray(klineData)) {
        throw new Error("Formato de datos inválido")
      }

      const price = Number.parseFloat(priceData.lastPrice) || currentPrice
      const priceChange = Number.parseFloat(priceData.priceChangePercent) || 0
      const volume24h = Number.parseFloat(priceData.volume) || 0
      const high24h = Number.parseFloat(priceData.highPrice) || price
      const low24h = Number.parseFloat(priceData.lowPrice) || price

      // Calcular datos adicionales de las últimas velas con validación
      const recentCandles = klineData
        .slice(-20)
        .map((k: any) => {
          try {
            return {
              open: Number.parseFloat(k[1]) || 0,
              high: Number.parseFloat(k[2]) || 0,
              low: Number.parseFloat(k[3]) || 0,
              close: Number.parseFloat(k[4]) || 0,
              volume: Number.parseFloat(k[5]) || 0,
            }
          } catch (e) {
            return {
              open: 0,
              high: 0,
              low: 0,
              close: 0,
              volume: 0,
            }
          }
        })
        .filter((c) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)

      // Obtener indicadores actuales con validaciones
      const currentIndicators = {
        rsi: indicators.rsi.length > 0 ? indicators.rsi[indicators.rsi.length - 1] || 50 : 50,
        macd: {
          value: indicators.macd.macd.length > 0 ? indicators.macd.macd[indicators.macd.macd.length - 1] || 0 : 0,
          signal:
            indicators.macd.signal.length > 0 ? indicators.macd.signal[indicators.macd.signal.length - 1] || 0 : 0,
          histogram:
            indicators.macd.histogram.length > 0
              ? indicators.macd.histogram[indicators.macd.histogram.length - 1] || 0
              : 0,
        },
        ema10: indicators.ema10.length > 0 ? indicators.ema10[indicators.ema10.length - 1] || price : price,
        ema55: indicators.ema55.length > 0 ? indicators.ema55[indicators.ema55.length - 1] || price : price,
        ema200: indicators.ema200.length > 0 ? indicators.ema200[indicators.ema200.length - 1] || price : price,
        ema365: indicators.ema365.length > 0 ? indicators.ema365[indicators.ema365.length - 1] || price : price,
      }

      // Calcular tendencias y patrones
      const priceAboveEMA10 = price > currentIndicators.ema10
      const priceAboveEMA55 = price > currentIndicators.ema55
      const priceAboveEMA200 = price > currentIndicators.ema200
      const emaAlignment =
        currentIndicators.ema10 > currentIndicators.ema55 && currentIndicators.ema55 > currentIndicators.ema200
      const macdBullish = currentIndicators.macd.value > currentIndicators.macd.signal

      // Calcular volumen promedio con validación
      const validVolumes = recentCandles.map((c) => c.volume).filter((v) => !isNaN(v) && v > 0)
      const volumeAvg =
        validVolumes.length > 0 ? validVolumes.reduce((sum, v) => sum + v, 0) / validVolumes.length : 1000000

      // Datos completos para la IA
      const comprehensiveMarketData = {
        // Precio actual y datos básicos
        currentPrice: price,
        priceChange24h: priceChange,
        high24h: high24h,
        low24h: low24h,
        volume24h: volume24h,

        // Indicadores técnicos
        indicators: currentIndicators,

        // Análisis de tendencias
        trends: {
          priceAboveEMA10,
          priceAboveEMA55,
          priceAboveEMA200,
          emaAlignment,
          macdBullish,
          rsiBullish: currentIndicators.rsi < 70 && currentIndicators.rsi > 30,
          rsiOverbought: currentIndicators.rsi > 70,
          rsiOversold: currentIndicators.rsi < 30,
        },

        // Datos de velas recientes
        recentCandles: recentCandles.slice(-5),
        volumeAnalysis: {
          currentVolume: recentCandles.length > 0 ? recentCandles[recentCandles.length - 1]?.volume || 0 : 0,
          averageVolume: volumeAvg,
          volumeRatio:
            recentCandles.length > 0 ? (recentCandles[recentCandles.length - 1]?.volume || 0) / volumeAvg : 1,
        },

        // Estado de la cuenta
        account: {
          balance: balance,
          activePositions: positions.length,
          maxPositionSize: Number.parseFloat(maxPositionSize) || 100,
          riskLevel: balance > 400 ? "conservative" : balance > 200 ? "moderate" : "aggressive",
        },

        // Contexto temporal
        timestamp: new Date().toISOString(),
        marketSession: new Date().getHours() >= 9 && new Date().getHours() <= 16 ? "active" : "quiet",
      }

      console.log("Enviando datos completos a IA:", comprehensiveMarketData)

      const aiAnalysis = await callOpenAI(comprehensiveMarketData)
      setCurrentAnalysis(aiAnalysis.reasoning)
      setApiError(null)

      // SIEMPRE ejecutar la decisión de IA (crear posición)
      const executionResult = await executeAIDecision(aiAnalysis, price)

      const newDecision = {
        action: aiAnalysis.action,
        confidence: aiAnalysis.confidence,
        reasoning: aiAnalysis.reasoning,
        amount: aiAnalysis.amount,
        leverage: aiAnalysis.leverage,
        timestamp: Date.now(),
        executed: executionResult.success,
        positionId: executionResult.positionId,
        marketData: {
          price: price,
          rsi: currentIndicators.rsi,
          macd: currentIndicators.macd.value,
          trend: emaAlignment ? "bullish" : "bearish",
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
    const prompt = `
  Eres un bot de trading profesional de Bitcoin. Analiza estos datos COMPLETOS del mercado y toma una decisión DEFINITIVA:

  === DATOS DE PRECIO ===
  Precio actual: $${marketData.currentPrice}
  Cambio 24h: ${marketData.priceChange24h}%
  Máximo 24h: $${marketData.high24h}
  Mínimo 24h: $${marketData.low24h}
  Volumen 24h: ${marketData.volume24h} BTC

  === INDICADORES TÉCNICOS ===
  RSI (14): ${marketData.indicators.rsi}
  MACD: ${marketData.indicators.macd.value} (Señal: ${marketData.indicators.macd.signal}, Histograma: ${marketData.indicators.macd.histogram})
  EMA10: $${marketData.indicators.ema10}
  EMA55: $${marketData.indicators.ema55}
  EMA200: $${marketData.indicators.ema200}
  EMA365: $${marketData.indicators.ema365}

  === ANÁLISIS DE TENDENCIAS ===
  Precio > EMA10: ${marketData.trends.priceAboveEMA10}
  Precio > EMA55: ${marketData.trends.priceAboveEMA55}
  Precio > EMA200: ${marketData.trends.priceAboveEMA200}
  Alineación EMAs (alcista): ${marketData.trends.emaAlignment}
  MACD alcista: ${marketData.trends.macdBullish}
  RSI sobrecompra: ${marketData.trends.rsiOverbought}
  RSI sobreventa: ${marketData.trends.rsiOversold}

  === ANÁLISIS DE VOLUMEN ===
  Volumen actual: ${marketData.volumeAnalysis.currentVolume}
  Volumen promedio: ${marketData.volumeAnalysis.averageVolume.toFixed(0)}
  Ratio volumen: ${marketData.volumeAnalysis.volumeRatio.toFixed(2)}x

  === VELAS RECIENTES ===
  ${marketData.recentCandles
    .map((c: any, i: number) => `Vela ${i + 1}: Open $${c.open} High $${c.high} Low $${c.low} Close $${c.close}`)
    .join("\n")}

  === ESTADO DE CUENTA ===
  Balance: $${marketData.account.balance}
  Posiciones activas: ${marketData.account.activePositions}
  Tamaño máximo: $${marketData.account.maxPositionSize}
  Nivel de riesgo: ${marketData.account.riskLevel}

  === CONTEXTO ===
  Sesión de mercado: ${marketData.marketSession}
  Timestamp: ${marketData.timestamp}

  INSTRUCCIONES OBLIGATORIAS:
  1. NUNCA respondas "hold" - SIEMPRE elige "buy" o "sell"
  2. Usa TODOS los datos proporcionados para tu análisis
  3. Confianza mínima: 65%
  4. Considera el contexto completo del mercado
  5. Justifica tu decisión con datos específicos
  6. Esta decisión CREARÁ una posición automáticamente

  ESTRATEGIA DE DECISIÓN:
  - RSI > 70 + tendencia bajista = SELL
  - RSI < 30 + tendencia alcista = BUY  
  - Alineación EMAs + MACD positivo = BUY
  - Ruptura de EMAs + MACD negativo = SELL
  - Alto volumen + momentum = seguir tendencia
  - Bajo volumen = contrarian

  Responde SOLO en formato JSON:
  {
    "action": "buy",
    "confidence": 75,
    "amount": 80,
    "leverage": 3,
    "reasoning": "Análisis detallado basado en los datos proporcionados..."
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
      // Fallback inteligente basado en múltiples indicadores
      const bullishSignals = [
        marketData.trends.priceAboveEMA10,
        marketData.trends.emaAlignment,
        marketData.trends.macdBullish,
        marketData.indicators.rsi < 70,
        marketData.volumeAnalysis.volumeRatio > 1.2,
      ].filter(Boolean).length

      const fallbackAction = bullishSignals >= 3 ? "buy" : "sell"

      return {
        action: fallbackAction,
        confidence: 65 + bullishSignals * 5,
        amount: Math.min(Number.parseFloat(maxPositionSize) || 50, balance * 0.2),
        leverage: marketData.account.riskLevel === "conservative" ? 2 : 3,
        reasoning: `Análisis automático: ${bullishSignals}/5 señales alcistas. ${fallbackAction === "buy" ? "Predominan señales de compra" : "Predominan señales de venta"}.`,
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
      // Luego cada 30 segundos
      interval = setInterval(analyzeMarket, 300000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAIActive, apiKeys.openai, indicators])

  // Dibujar el gráfico
  useEffect(() => {
    if (!canvasRef.current || candles.length === 0) return

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!
      const { width, height } = canvas

      // Limpiar canvas
      ctx.clearRect(0, 0, width, height)

      // Configurar dimensiones del gráfico
      const padding = 60
      const chartWidth = width - padding * 2
      const chartHeight = height - padding * 2

      // Calcular rangos de precios con navegación
      const startIndex = Math.max(0, candles.length - visibleCandleCount - chartOffset)
      const endIndex = Math.max(visibleCandleCount, candles.length - chartOffset)
      const visibleCandles = candles.slice(startIndex, endIndex)

      // Validar que haya velas visibles
      if (visibleCandles.length === 0) return

      const prices = visibleCandles.flatMap((c) => [c.high, c.low])

      // Validar que haya precios válidos
      if (prices.length === 0) return

      const validPrices = prices.filter((p) => !isNaN(p) && isFinite(p) && p > 0)

      // Si no hay precios válidos, salir
      if (validPrices.length === 0) return

      const minPrice = Math.min(...validPrices)
      const maxPrice = Math.max(...validPrices)

      // Validar rango de precios
      if (minPrice === maxPrice) {
        // Evitar división por cero
        return
      }

      const priceRange = maxPrice - minPrice

      const candleWidth = chartWidth / visibleCandles.length
      const priceToY = (price: number) => {
        if (isNaN(price) || !isFinite(price)) return padding
        return padding + ((maxPrice - price) / priceRange) * chartHeight
      }

      // Dibujar solo etiquetas de precio (sin líneas del grid)
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim() || "#000"
      ctx.font = "12px sans-serif"
      
      // Etiquetas de precio sin líneas horizontales
      for (let i = 0; i <= 10; i++) {
        const y = padding + (chartHeight / 10) * i
        const price = maxPrice - (priceRange / 10) * i
        ctx.fillText(price.toFixed(2), 10, y + 4)
      }

      // Dibujar velas japonesas
      visibleCandles.forEach((candle, index) => {
        // Validar datos de la vela
        if (isNaN(candle.open) || isNaN(candle.high) || isNaN(candle.low) || isNaN(candle.close)) {
          return
        }

        const x = padding + index * candleWidth + candleWidth / 2
        const openY = priceToY(candle.open)
        const closeY = priceToY(candle.close)
        const highY = priceToY(candle.high)
        const lowY = priceToY(candle.low)

        const isGreen = candle.close > candle.open
        ctx.strokeStyle = isGreen ? "#10b981" : "#ef4444"
        ctx.fillStyle = isGreen ? "#10b981" : "#ef4444"

        // Mecha
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, highY)
        ctx.lineTo(x, lowY)
        ctx.stroke()

        // Cuerpo de la vela
        const bodyTop = Math.min(openY, closeY)
        const bodyHeight = Math.abs(closeY - openY)
        const bodyWidth = candleWidth * 0.8

        ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight)
      })

      // Dibujar indicadores EMA
      const drawEMA = (ema: number[], color: string, lineWidth = 2) => {
        if (ema.length === 0) return

        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.beginPath()

        const visibleEMA = ema.slice(-visibleCandles.length)
        let firstPointDrawn = false

        visibleEMA.forEach((value, index) => {
          if (isNaN(value) || !isFinite(value)) return

          const x = padding + index * candleWidth + candleWidth / 2
          const y = priceToY(value)

          if (!firstPointDrawn) {
            ctx.moveTo(x, y)
            firstPointDrawn = true
          } else {
            ctx.lineTo(x, y)
          }
        })

        ctx.stroke()
      }

      if (showIndicators.ema10) drawEMA(indicators.ema10, "#3b82f6", 2)
      if (showIndicators.ema55) drawEMA(indicators.ema55, "#f59e0b", 2)
      if (showIndicators.ema200) drawEMA(indicators.ema200, "#ef4444", 2)
      if (showIndicators.ema365) drawEMA(indicators.ema365, "#8b5cf6", 2)

      // Dibujar líneas de posiciones de IA
      const aiPositions = positions.filter((p: any) => p.isAI)
      aiPositions.forEach((position: any) => {
        const entryY = priceToY(position.entryPrice)
        const color = position.type === "long" ? "#10b981" : "#ef4444"
        
        // Línea horizontal del precio de entrada
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5]) // Línea punteada
        ctx.beginPath()
        ctx.moveTo(padding, entryY)
        ctx.lineTo(width - padding, entryY)
        ctx.stroke()
        ctx.setLineDash([]) // Resetear línea punteada
        
        // Etiqueta con información de la posición
        ctx.fillStyle = color
        ctx.font = "12px sans-serif"
        const label = `AI ${position.type.toUpperCase()} $${position.entryPrice.toFixed(2)} (${position.leverage}x)`
        const labelWidth = ctx.measureText(label).width
        
        // Fondo para la etiqueta con color según el tipo
        const backgroundColor = position.type === "long" ? "rgba(16, 185, 129, 0.8)" : "rgba(239, 68, 68, 0.8)"
        ctx.fillStyle = backgroundColor
        ctx.fillRect(width - padding - labelWidth - 10, entryY - 15, labelWidth + 8, 20)
        
        // Texto de la etiqueta en blanco para mejor contraste
        ctx.fillStyle = "#ffffff"
        ctx.fillText(label, width - padding - labelWidth - 6, entryY + 2)
      })

      // Precio actual
      ctx.fillStyle = "#10b981"
      ctx.font = "bold 16px sans-serif"
      ctx.fillText(`$${currentPrice.toFixed(2)}`, width - 150, 30)
    } catch (error) {
      console.error("Error dibujando gráfico:", error)
    }
  }, [candles, indicators, showIndicators, currentPrice, chartOffset, visibleCandleCount, positions])

  // Handlers para navegación con el ratón
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setLastMouseX(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    
    const deltaX = e.clientX - lastMouseX
    const candlesToMove = Math.round(deltaX / 8) // Sensibilidad del movimiento
    
    setChartOffset(prev => {
      const newOffset = prev - candlesToMove
      const maxOffset = Math.max(0, candles.length - visibleCandleCount)
      return Math.max(0, Math.min(maxOffset, newOffset))
    })
    
    setLastMouseX(e.clientX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    
    if (e.ctrlKey) {
      // Zoom con Ctrl + rueda
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
      setVisibleCandleCount(prev => {
        const newCount = Math.round(prev * zoomFactor)
        return Math.max(20, Math.min(500, newCount))
      })
    } else {
      // Navegación horizontal con rueda
      const scrollAmount = e.deltaY > 0 ? 5 : -5
      setChartOffset(prev => {
        const newOffset = prev + scrollAmount
        const maxOffset = Math.max(0, candles.length - visibleCandleCount)
        return Math.max(0, Math.min(maxOffset, newOffset))
      })
    }
  }

  return (
    <Card className="h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">BTC/USDT - 1m</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-green-500">
            ${currentPrice.toFixed(2)}
          </Badge>
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant={showIndicators.ema10 ? "default" : "outline"}
              onClick={() => setShowIndicators((prev) => ({ ...prev, ema10: !prev.ema10 }))}
            >
              EMA10
            </Button>
            <Button
              size="sm"
              variant={showIndicators.ema55 ? "default" : "outline"}
              onClick={() => setShowIndicators((prev) => ({ ...prev, ema55: !prev.ema55 }))}
            >
              EMA55
            </Button>
            <Button
              size="sm"
              variant={showIndicators.ema200 ? "default" : "outline"}
              onClick={() => setShowIndicators((prev) => ({ ...prev, ema200: !prev.ema200 }))}
            >
              EMA200
            </Button>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="mb-4 p-2 bg-red-50 text-red-600 rounded-md flex items-center text-sm">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <span>{apiError}</span>
        </div>
      )}

      <div className="text-sm text-muted-foreground mb-2">
        💡 Arrastra para navegar • Rueda del ratón para desplazar • Ctrl + Rueda para zoom
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full border rounded cursor-grab active:cursor-grabbing"
        style={{ maxHeight: "400px" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

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
                    <div className="text-xs text-muted-foreground">
                      Precio: ${aiDecisions[0].marketData.price.toFixed(2)} | RSI:{" "}
                      {aiDecisions[0].marketData.rsi.toFixed(1)} | Tendencia: {aiDecisions[0].marketData.trend}
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
