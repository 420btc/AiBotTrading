"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Settings } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface IndicatorData {
  ema10: number[]
  ema55: number[]
  ema200: number[]
  ema365: number[]
  rsi: number[]
  macd: { macd: number[]; signal: number[]; histogram: number[] }
}

interface TradingMark {
  timestamp: number
  type: 'LONG' | 'SHORT'
  price: number
  id: string
}

interface CanvasTradingChartProps {
  apiKeys: { openai?: string }
  tradingMarks?: TradingMark[]
  onAddTradingMark?: (mark: TradingMark) => void
  onClearTradingMarks?: () => void
}

export function CanvasTradingChart({ tradingMarks = [], onAddTradingMark, onClearTradingMarks }: CanvasTradingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [candleData, setCandleData] = useState<CandleData[]>([])
  const [indicators, setIndicators] = useState<IndicatorData>({
    ema10: [],
    ema55: [],
    ema200: [],
    ema365: [],
    rsi: [],
    macd: { macd: [], signal: [], histogram: [] }
  })
  const [currentPrice, setCurrentPrice] = useState(0)
  const [priceChange24h, setPriceChange24h] = useState(0)
  const [volume24h, setVolume24h] = useState(0)
  const [high24h, setHigh24h] = useState(0)
  const [low24h, setLow24h] = useState(0)
  const [apiError, setApiError] = useState<string | null>(null)
  
  // Chart state
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null)
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null)
  const [showIndicators, setShowIndicators] = useState({
    ema10: true,
    ema55: true,
    ema200: true,
    ema365: true,
    volume: true,
    rsi: true,
    macd: true
  })
  const [showTradingMarks, setShowTradingMarks] = useState(true)

  // Calcular EMA
  const calculateEMA = useCallback((data: number[], period: number): number[] => {
    const ema: number[] = []
    const multiplier = 2 / (period + 1)
    
    if (data.length === 0) return ema
    
    ema[0] = data[0]
    
    for (let i = 1; i < data.length; i++) {
      ema[i] = (data[i] * multiplier) + (ema[i - 1] * (1 - multiplier))
    }
    
    return ema
  }, [])

  // Calcular RSI
  const calculateRSI = useCallback((data: number[], period: number = 14): number[] => {
    const rsi: number[] = []
    const gains: number[] = []
    const losses: number[] = []
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1]
      gains.push(change > 0 ? change : 0)
      losses.push(change < 0 ? Math.abs(change) : 0)
    }
    
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      
      if (avgLoss === 0) {
        rsi.push(100)
      } else {
        const rs = avgGain / avgLoss
        rsi.push(100 - (100 / (1 + rs)))
      }
    }
    
    return rsi
  }, [])

  // Calcular MACD
  const calculateMACD = useCallback((data: number[]): { macd: number[]; signal: number[]; histogram: number[] } => {
    const ema12 = calculateEMA(data, 12)
    const ema26 = calculateEMA(data, 26)
    const macdLine: number[] = []
    
    for (let i = 0; i < Math.min(ema12.length, ema26.length); i++) {
      macdLine.push(ema12[i] - ema26[i])
    }
    
    const signalLine = calculateEMA(macdLine, 9)
    const histogram: number[] = []
    
    for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
      histogram.push(macdLine[i] - signalLine[i])
    }
    
    return { macd: macdLine, signal: signalLine, histogram }
  }, [calculateEMA])

  // Obtener datos de mercado
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        // Obtener datos de ticker 24h
        const tickerResponse = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
        const tickerData = await tickerResponse.json()
        
        if (tickerData && !tickerData.code) {
          setCurrentPrice(parseFloat(tickerData.lastPrice))
          setPriceChange24h(parseFloat(tickerData.priceChangePercent))
          setVolume24h(parseFloat(tickerData.volume))
          setHigh24h(parseFloat(tickerData.highPrice))
          setLow24h(parseFloat(tickerData.lowPrice))
        }

        // Obtener datos de velas (más velas para mejor visualización)
        const candleResponse = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=500")
        const candleRawData = await candleResponse.json()
        
        if (candleRawData && Array.isArray(candleRawData)) {
          const processedData: CandleData[] = candleRawData.map((candle: any[]) => ({
            timestamp: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
          }))
          
          setCandleData(processedData)
          
          // Calcular indicadores
          const closePrices = processedData.map(d => d.close)
          const ema10 = calculateEMA(closePrices, 10)
          const ema55 = calculateEMA(closePrices, 55)
          const ema200 = calculateEMA(closePrices, 200)
          const ema365 = calculateEMA(closePrices, 365)
          const rsi = calculateRSI(closePrices)
          const macd = calculateMACD(closePrices)
          
          setIndicators({
            ema10,
            ema55,
            ema200,
            ema365,
            rsi,
            macd
          })
        }
        
        setApiError(null)
      } catch (error) {
        console.error("Error obteniendo datos de mercado:", error)
        setApiError("Error obteniendo datos de Binance")
      }
    }

    fetchMarketData()
    const interval = setInterval(fetchMarketData, 30000)
    
    return () => clearInterval(interval)
  }, [calculateEMA, calculateRSI])

  // Dibujar el gráfico
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || candleData.length === 0) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const { width, height } = canvas
    const margin = { top: 20, right: 80, bottom: 60, left: 80 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom
    
    // Limpiar canvas
    ctx.fillStyle = '#1e1e2e'
    ctx.fillRect(0, 0, width, height)
    
    // Calcular escalas
    const candleWidth = Math.max(2, (chartWidth * viewport.scale) / candleData.length)
    const startIndex = Math.max(0, Math.floor(-viewport.offsetX / candleWidth))
    const endIndex = Math.min(candleData.length, Math.floor((-viewport.offsetX + chartWidth) / candleWidth) + 1)
    const visibleData = candleData.slice(startIndex, endIndex)
    
    if (visibleData.length === 0) return
    
    const minPrice = Math.min(...visibleData.map(d => d.low))
    const maxPrice = Math.max(...visibleData.map(d => d.high))
    const priceRange = maxPrice - minPrice
    
    // Función para convertir precio a coordenada Y
    const priceToY = (price: number) => {
      return margin.top + viewport.offsetY + ((maxPrice - price) / priceRange) * chartHeight
    }
    
    // Función para convertir índice a coordenada X
    const indexToX = (index: number) => {
      return margin.left + viewport.offsetX + (index * candleWidth)
    }
    
    // Dibujar grid
    ctx.strokeStyle = '#363c4e'
    ctx.lineWidth = 1
    
    // Grid horizontal
    for (let i = 0; i <= 10; i++) {
      const y = margin.top + (i * chartHeight / 10)
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(width - margin.right, y)
      ctx.stroke()
      
      // Etiquetas de precio
      const price = maxPrice - (i * priceRange / 10)
      ctx.fillStyle = '#d9d9d9'
      ctx.font = '12px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(`$${price.toFixed(2)}`, width - margin.right + 5, y + 4)
    }
    
    // Grid vertical
    const timeStep = Math.max(1, Math.floor(candleData.length / 10))
    for (let i = 0; i < candleData.length; i += timeStep) {
      const x = indexToX(i)
      if (x >= margin.left && x <= width - margin.right) {
        ctx.beginPath()
        ctx.moveTo(x, margin.top)
        ctx.lineTo(x, height - margin.bottom)
        ctx.stroke()
        
        // Etiquetas de tiempo
        const date = new Date(candleData[i].timestamp)
        ctx.fillStyle = '#d9d9d9'
        ctx.font = '10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(
          `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
          x,
          height - margin.bottom + 15
        )
      }
    }
    
    // Dibujar indicadores EMA
    if (showIndicators.ema10 && indicators.ema10.length > 0) {
      ctx.strokeStyle = '#9C27B0' // Morado
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < candleData.length; i++) {
        const x = indexToX(i)
        const y = priceToY(indicators.ema10[i] || candleData[i].close)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    
    if (showIndicators.ema55 && indicators.ema55.length > 0) {
      ctx.strokeStyle = '#FFD700' // Dorada
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < candleData.length; i++) {
        const x = indexToX(i)
        const y = priceToY(indicators.ema55[i] || candleData[i].close)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    
    if (showIndicators.ema200 && indicators.ema200.length > 0) {
      ctx.strokeStyle = '#2196F3' // Azul
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < candleData.length; i++) {
        const x = indexToX(i)
        const y = priceToY(indicators.ema200[i] || candleData[i].close)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    
    if (showIndicators.ema365 && indicators.ema365.length > 0) {
      ctx.strokeStyle = '#4CAF50' // Verde
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < candleData.length; i++) {
        const x = indexToX(i)
        const y = priceToY(indicators.ema365[i] || candleData[i].close)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    
    // Dibujar velas
    candleData.forEach((candle, index) => {
      const x = indexToX(index)
      
      if (x < margin.left - candleWidth || x > width - margin.right + candleWidth) return
      
      const openY = priceToY(candle.open)
      const closeY = priceToY(candle.close)
      const highY = priceToY(candle.high)
      const lowY = priceToY(candle.low)
      
      const isGreen = candle.close > candle.open
      const color = isGreen ? '#00d4aa' : '#ff6b6b'
      
      // Línea vertical (high-low)
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()
      
      // Cuerpo de la vela
      const bodyHeight = Math.abs(closeY - openY)
      const bodyY = Math.min(openY, closeY)
      
      ctx.fillStyle = color
      ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, Math.max(1, bodyHeight))
    })
    
    // Dibujar marcas de trading si están habilitadas
    if (showTradingMarks && tradingMarks.length > 0) {
      tradingMarks.forEach(mark => {
        // Encontrar la vela correspondiente al timestamp
        const candleIndex = candleData.findIndex(candle => 
          Math.abs(candle.timestamp - mark.timestamp) < 60000 // Tolerancia de 1 minuto
        )
        
        if (candleIndex !== -1) {
          const x = indexToX(candleIndex)
          const candle = candleData[candleIndex]
          
          if (x >= margin.left - candleWidth && x <= width - margin.right + candleWidth) {
            const markY = mark.type === 'LONG' ? priceToY(candle.low) + 20 : priceToY(candle.high) - 20
            const markColor = mark.type === 'LONG' ? '#00ff88' : '#ff4444'
            
            // Dibujar triángulo de marca
            ctx.fillStyle = markColor
            ctx.beginPath()
            if (mark.type === 'LONG') {
              // Triángulo hacia arriba para LONG
              ctx.moveTo(x, markY - 8)
              ctx.lineTo(x - 6, markY + 4)
              ctx.lineTo(x + 6, markY + 4)
            } else {
              // Triángulo hacia abajo para SHORT
              ctx.moveTo(x, markY + 8)
              ctx.lineTo(x - 6, markY - 4)
              ctx.lineTo(x + 6, markY - 4)
            }
            ctx.closePath()
            ctx.fill()
            
            // Dibujar texto de la marca
            ctx.fillStyle = markColor
            ctx.font = 'bold 10px Arial'
            ctx.textAlign = 'center'
            ctx.fillText(
              mark.type,
              x,
              mark.type === 'LONG' ? markY + 18 : markY - 10
            )
          }
        }
      })
    }
    
    // Dibujar volumen si está habilitado
    if (showIndicators.volume) {
      const maxVolume = Math.max(...candleData.map(d => d.volume))
      const volumeHeight = 40
      const volumeY = height - margin.bottom - 160
      
      candleData.forEach((candle, index) => {
        const x = indexToX(index)
        if (x < margin.left - candleWidth || x > width - margin.right + candleWidth) return
        
        const volumeBarHeight = (candle.volume / maxVolume) * volumeHeight
        const isGreen = candle.close > candle.open
        
        ctx.fillStyle = isGreen ? 'rgba(0, 212, 170, 0.6)' : 'rgba(255, 107, 107, 0.6)'
        ctx.fillRect(x - candleWidth / 2, volumeY + volumeHeight - volumeBarHeight, candleWidth, volumeBarHeight)
      })
    }
    
    // Dibujar RSI si está habilitado
    if (showIndicators.rsi && indicators.rsi.length > 0) {
      const rsiHeight = 50
      const rsiY = height - margin.bottom - 110
      
      // Fondo del RSI
      ctx.fillStyle = 'rgba(30, 30, 46, 0.8)'
      ctx.fillRect(margin.left, rsiY, chartWidth, rsiHeight)
      
      // Líneas de referencia RSI
      ctx.strokeStyle = '#363c4e'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(margin.left, rsiY + rsiHeight * 0.3) // 70
      ctx.lineTo(width - margin.right, rsiY + rsiHeight * 0.3)
      ctx.moveTo(margin.left, rsiY + rsiHeight * 0.7) // 30
      ctx.lineTo(width - margin.right, rsiY + rsiHeight * 0.7)
      ctx.stroke()
      
      // Línea RSI
      ctx.strokeStyle = '#E91E63'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < indicators.rsi.length; i++) {
        const x = indexToX(i + 14) // RSI empieza después del período
        const rsiValue = indicators.rsi[i]
        const y = rsiY + rsiHeight - (rsiValue / 100) * rsiHeight
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    
    // Dibujar MACD si está habilitado
    if (showIndicators.macd && indicators.macd.macd.length > 0) {
      const macdHeight = 50
      const macdY = height - margin.bottom - 50
      
      // Fondo del MACD
      ctx.fillStyle = 'rgba(30, 30, 46, 0.8)'
      ctx.fillRect(margin.left, macdY, chartWidth, macdHeight)
      
      // Línea cero
      ctx.strokeStyle = '#363c4e'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(margin.left, macdY + macdHeight / 2)
      ctx.lineTo(width - margin.right, macdY + macdHeight / 2)
      ctx.stroke()
      
      // Histograma MACD
      const maxMacd = Math.max(...indicators.macd.histogram.map(Math.abs))
      indicators.macd.histogram.forEach((value, index) => {
        const x = indexToX(index + 26) // MACD empieza después del período
        const barHeight = (Math.abs(value) / maxMacd) * (macdHeight / 2)
        const barY = value >= 0 ? macdY + macdHeight / 2 - barHeight : macdY + macdHeight / 2
        
        ctx.fillStyle = value >= 0 ? 'rgba(0, 212, 170, 0.6)' : 'rgba(255, 107, 107, 0.6)'
        ctx.fillRect(x - candleWidth / 2, barY, candleWidth, barHeight)
      })
      
      // Línea MACD
      ctx.strokeStyle = '#2196F3'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < indicators.macd.macd.length; i++) {
        const x = indexToX(i + 26)
        const value = indicators.macd.macd[i]
        const y = macdY + macdHeight / 2 - (value / maxMacd) * (macdHeight / 4)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      
      // Línea Signal
      ctx.strokeStyle = '#FF9800'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < indicators.macd.signal.length; i++) {
        const x = indexToX(i + 35) // Signal empieza después
        const value = indicators.macd.signal[i]
        const y = macdY + macdHeight / 2 - (value / maxMacd) * (macdHeight / 4)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    
    // Dibujar crosshair
    if (crosshair) {
      ctx.strokeStyle = '#758696'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      
      // Línea horizontal
      ctx.beginPath()
      ctx.moveTo(margin.left, crosshair.y)
      ctx.lineTo(width - margin.right, crosshair.y)
      ctx.stroke()
      
      // Línea vertical
      ctx.beginPath()
      ctx.moveTo(crosshair.x, margin.top)
      ctx.lineTo(crosshair.x, height - margin.bottom)
      ctx.stroke()
      
      ctx.setLineDash([])
      
      // Mostrar precio en crosshair
      const price = maxPrice - ((crosshair.y - margin.top) / chartHeight) * priceRange
      ctx.fillStyle = '#1e1e2e'
      ctx.fillRect(width - margin.right, crosshair.y - 10, 70, 20)
      ctx.strokeStyle = '#758696'
      ctx.strokeRect(width - margin.right, crosshair.y - 10, 70, 20)
      ctx.fillStyle = '#d9d9d9'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`$${price.toFixed(2)}`, width - margin.right + 35, crosshair.y + 4)
    }
    
  }, [candleData, indicators, viewport, crosshair, showIndicators])

  // Redimensionar canvas
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = 500
    
    drawChart()
  }, [drawChart])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas])

  useEffect(() => {
    drawChart()
  }, [drawChart])

  // Event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setCrosshair({ x, y })
    
    if (isDragging && lastMousePos) {
        const deltaX = e.clientX - lastMousePos.x
        const deltaY = e.clientY - lastMousePos.y
        
        setViewport(prev => ({
          ...prev,
          offsetX: prev.offsetX + deltaX,
          offsetY: prev.offsetY + deltaY
        }))
      
      setLastMousePos({ x: e.clientX, y: e.clientY })
    }
  }, [isDragging, lastMousePos, candleData.length])

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setCrosshair(null)
    setIsDragging(false)
  }
  
  // Manejar doble clic para agregar marcas de trading
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onAddTradingMark || candleData.length === 0) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const margin = { top: 20, right: 80, bottom: 60, left: 80 }
    const chartWidth = canvas.width - margin.left - margin.right
    const chartHeight = canvas.height - margin.top - margin.bottom
    
    // Calcular qué vela se clickeó
    const candleWidth = Math.max(2, (chartWidth * viewport.scale) / candleData.length)
    const candleIndex = Math.floor((x - margin.left - viewport.offsetX) / candleWidth)
    
    if (candleIndex >= 0 && candleIndex < candleData.length) {
      const candle = candleData[candleIndex]
      const minPrice = Math.min(...candleData.map(d => d.low))
      const maxPrice = Math.max(...candleData.map(d => d.high))
      const priceRange = maxPrice - minPrice
      
      // Calcular el precio basado en la posición Y
      const clickedPrice = maxPrice - ((y - margin.top - viewport.offsetY) / chartHeight) * priceRange
      
      // Determinar si es LONG o SHORT basado en la posición Y relativa a la vela
      const candleMidPrice = (candle.high + candle.low) / 2
      const markType = clickedPrice < candleMidPrice ? 'LONG' : 'SHORT'
      
      const newMark: TradingMark = {
        timestamp: candle.timestamp,
        type: markType as 'LONG' | 'SHORT',
        price: clickedPrice,
        id: `mark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
      
      onAddTradingMark(newMark)
    }
  }, [candleData, viewport, onAddTradingMark])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - 80 // Ajustar por el margen izquierdo
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    
    setViewport(prev => {
      const newScale = Math.max(0.5, Math.min(5, prev.scale * zoomFactor))
      const chartWidth = canvas.width - 160
      const candleWidth = Math.max(2, (chartWidth * newScale) / candleData.length)
      
      // Calcular el nuevo offset para mantener el zoom centrado en el cursor
      const mouseRatio = mouseX / chartWidth
      const totalWidth = candleData.length * candleWidth
      const newOffsetX = -mouseRatio * totalWidth + mouseX
      
      const maxOffset = Math.max(0, totalWidth - chartWidth)
      
      return {
         scale: newScale,
         offsetX: newOffsetX,
         offsetY: prev.offsetY
       }
    })
  }, [candleData.length])

  const resetZoom = () => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
  }

  const zoomIn = () => {
    setViewport(prev => ({ ...prev, scale: Math.min(5, prev.scale * 1.2) }))
  }

  const zoomOut = () => {
    setViewport(prev => ({ ...prev, scale: Math.max(0.5, prev.scale * 0.8) }))
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">BTC/USDT - Canvas Chart</h2>
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

        {/* Controles del gráfico */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={resetZoom}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Zoom: {viewport.scale.toFixed(1)}x</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch 
                checked={showIndicators.ema10} 
                onCheckedChange={(checked) => setShowIndicators(prev => ({ ...prev, ema10: checked }))}
              />
              <Label className="text-sm">EMA 10</Label>
              <div className="w-3 h-3 bg-[#9C27B0] rounded"></div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                checked={showIndicators.ema55} 
                onCheckedChange={(checked) => setShowIndicators(prev => ({ ...prev, ema55: checked }))}
              />
              <Label className="text-sm">EMA 55</Label>
              <div className="w-3 h-3 bg-[#FFD700] rounded"></div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                checked={showIndicators.ema200} 
                onCheckedChange={(checked) => setShowIndicators(prev => ({ ...prev, ema200: checked }))}
              />
              <Label className="text-sm">EMA 200</Label>
              <div className="w-3 h-3 bg-[#2196F3] rounded"></div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                checked={showIndicators.ema365} 
                onCheckedChange={(checked) => setShowIndicators(prev => ({ ...prev, ema365: checked }))}
              />
              <Label className="text-sm">EMA 365</Label>
              <div className="w-3 h-3 bg-[#4CAF50] rounded"></div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                checked={showIndicators.volume} 
                onCheckedChange={(checked) => setShowIndicators(prev => ({ ...prev, volume: checked }))}
              />
              <Label className="text-sm">Volumen</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                checked={showIndicators.rsi} 
                onCheckedChange={(checked) => setShowIndicators(prev => ({ ...prev, rsi: checked }))}
              />
              <Label className="text-sm">RSI</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                checked={showIndicators.macd} 
                onCheckedChange={(checked) => setShowIndicators(prev => ({ ...prev, macd: checked }))}
              />
              <Label className="text-sm">MACD</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                checked={showTradingMarks} 
                onCheckedChange={setShowTradingMarks}
              />
              <Label className="text-sm">Marcas de Trading</Label>
              <div className="flex space-x-1">
                <div className="w-3 h-3 bg-[#00ff88] rounded"></div>
                <div className="w-3 h-3 bg-[#ff4444] rounded"></div>
              </div>
              {onClearTradingMarks && tradingMarks.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onClearTradingMarks}
                  className="ml-2 h-6 px-2 text-xs"
                >
                  Limpiar ({tradingMarks.length})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Información sobre marcas de trading */}
        {showTradingMarks && (
          <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded">
            💡 <strong>Marcas de Trading:</strong> Haz doble clic en cualquier vela para agregar una marca LONG (parte inferior) o SHORT (parte superior). 
            Las marcas aparecerán como triángulos verdes (LONG ▲) o rojos (SHORT ▼).
          </div>
        )}
        
        {/* Canvas del gráfico */}
        <div 
          ref={containerRef}
          className="w-full border rounded bg-[#1e1e2e] cursor-crosshair"
          style={{ 
            height: "500px",
            backgroundColor: "#1e1e2e",
            border: "1px solid #363c4e"
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </div>

        {/* Métricas básicas */}
        <div className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Cambio 24h</div>
                <div className={`text-lg font-semibold flex items-center ${
                  priceChange24h >= 0 ? "text-green-500" : "text-red-500"
                }`}>
                  {priceChange24h.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Máximo 24h</div>
                <div className="text-lg font-semibold">
                  ${high24h.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Mínimo 24h</div>
                <div className="text-lg font-semibold">
                  ${low24h.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Volumen 24h</div>
                <div className="text-lg font-semibold">
                  {volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })} BTC
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  )
}