"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Bot, TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface TradingMark {
  timestamp: number
  type: 'LONG' | 'SHORT'
  price: number
  id: string
}

interface EMATouchAnalyzerProps {
  apiKeys: { openai: string }
  onAddTradingMark?: (mark: TradingMark) => void
}

interface PriceData {
  price: number
  ema55: number
  ema200: number
  timestamp: number
}

interface EMATouchEvent {
  id: string
  type: "ema55" | "ema200"
  direction: "touch_from_above" | "touch_from_below" | "cross_above" | "cross_below"
  price: number
  emaValue: number
  timestamp: number
  analysis?: string
  recommendation?: "LONG" | "SHORT" | "NEUTRAL"
  confidence?: number
}

export function EMATouchAnalyzer({ apiKeys, onAddTradingMark }: EMATouchAnalyzerProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentPrice, setCurrentPrice] = useState(0)
  const [emaValues, setEmaValues] = useState({ ema55: 0, ema200: 0 })
  const [touchEvents, setTouchEvents] = useState<EMATouchEvent[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState<string>("")
  
  // Referencias para detectar cruces
  const previousPriceRef = useRef<PriceData | null>(null)
  const lastEventTimeRef = useRef<number>(0)
  
  // Configuración de sensibilidad (porcentaje de tolerancia para detectar "toque")
  const TOUCH_TOLERANCE = 0.002 // 0.2%
  const MIN_EVENT_INTERVAL = 300000 // 5 minutos entre eventos

  // Obtener datos de precio y EMAs
  const fetchMarketData = async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
      const data = await response.json()
      const price = parseFloat(data.lastPrice)
      
      // Simular cálculo de EMAs (en implementación real vendrían de un servicio de indicadores)
      const ema55 = price * (0.995 + Math.random() * 0.01) // Simulación
      const ema200 = price * (0.99 + Math.random() * 0.02) // Simulación
      
      const newPriceData: PriceData = {
        price,
        ema55,
        ema200,
        timestamp: Date.now()
      }
      
      setCurrentPrice(price)
      setEmaValues({ ema55, ema200 })
      
      // Detectar eventos de toque/cruce
      if (previousPriceRef.current && isActive) {
        await detectEMAEvents(previousPriceRef.current, newPriceData)
      }
      
      previousPriceRef.current = newPriceData
      
    } catch (error) {
      console.error("Error obteniendo datos de mercado:", error)
    }
  }

  // Detectar eventos de toque o cruce con EMAs
  const detectEMAEvents = async (prevData: PriceData, currentData: PriceData) => {
    const now = Date.now()
    
    // Evitar eventos muy frecuentes
    if (now - lastEventTimeRef.current < MIN_EVENT_INTERVAL) {
      return
    }

    const events: EMATouchEvent[] = []

    // Detectar eventos con EMA 55
    const ema55Event = detectEMAInteraction(prevData, currentData, "ema55")
    if (ema55Event) {
      events.push(ema55Event)
    }

    // Detectar eventos con EMA 200
    const ema200Event = detectEMAInteraction(prevData, currentData, "ema200")
    if (ema200Event) {
      events.push(ema200Event)
    }

    // Procesar eventos detectados
    for (const event of events) {
      await processEMAEvent(event)
      lastEventTimeRef.current = now
    }
  }

  // Detectar interacción específica con una EMA
  const detectEMAInteraction = (prevData: PriceData, currentData: PriceData, emaType: "ema55" | "ema200"): EMATouchEvent | null => {
    const prevPrice = prevData.price
    const currentPrice = currentData.price
    const prevEMA = prevData[emaType]
    const currentEMA = currentData[emaType]
    
    // Calcular distancia relativa al EMA
    const currentDistance = Math.abs(currentPrice - currentEMA) / currentEMA
    const prevDistance = Math.abs(prevPrice - prevEMA) / prevEMA
    
    // Detectar toque (precio muy cerca del EMA)
    if (currentDistance <= TOUCH_TOLERANCE && prevDistance > TOUCH_TOLERANCE) {
      const direction = prevPrice > prevEMA ? "touch_from_above" : "touch_from_below"
      
      return {
        id: `${emaType}_${Date.now()}`,
        type: emaType,
        direction,
        price: currentPrice,
        emaValue: currentEMA,
        timestamp: currentData.timestamp
      }
    }
    
    // Detectar cruce
    const prevAbove = prevPrice > prevEMA
    const currentAbove = currentPrice > currentEMA
    
    if (prevAbove !== currentAbove) {
      const direction = currentAbove ? "cross_above" : "cross_below"
      
      return {
        id: `${emaType}_${Date.now()}`,
        type: emaType,
        direction,
        price: currentPrice,
        emaValue: currentEMA,
        timestamp: currentData.timestamp
      }
    }
    
    return null
  }

  // Procesar evento y solicitar análisis a OpenAI
  const processEMAEvent = async (event: EMATouchEvent) => {
    if (!apiKeys.openai) {
      console.log("API key de OpenAI no configurada")
      return
    }

    setIsAnalyzing(true)
    
    try {
      // Obtener datos adicionales del mercado
      const marketResponse = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
      const marketData = await marketResponse.json()
      
      const analysis = await requestEMAAnalysis(event, marketData)
      
      const updatedEvent: EMATouchEvent = {
        ...event,
        analysis: analysis.reasoning,
        recommendation: analysis.recommendation,
        confidence: analysis.confidence
      }
      
      setTouchEvents(prev => [updatedEvent, ...prev.slice(0, 9)])
      setLastAnalysis(analysis.reasoning)
      
      // Agregar marca de trading automáticamente si hay una recomendación válida
      if (onAddTradingMark && analysis.recommendation !== 'NEUTRAL' && analysis.confidence > 70) {
        const tradingMark: TradingMark = {
          timestamp: event.timestamp,
          type: analysis.recommendation,
          price: event.price,
          id: `ema-${event.type}-${event.timestamp}`
        }
        onAddTradingMark(tradingMark)
      }
      
    } catch (error) {
      console.error("Error procesando evento EMA:", error)
      
      // Agregar evento sin análisis
      setTouchEvents(prev => [{
        ...event,
        analysis: "Error al obtener análisis de IA",
        recommendation: "NEUTRAL",
        confidence: 0
      }, ...prev.slice(0, 9)])
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Solicitar análisis a OpenAI
  const requestEMAAnalysis = async (event: EMATouchEvent, marketData: any) => {
    const eventDescription = getEventDescription(event)
    
    const prompt = `
    Eres un trader experto de Bitcoin especializado en análisis técnico con medias móviles exponenciales (EMA).
    
    EVENTO DETECTADO:
    ${eventDescription}
    
    DATOS DEL MERCADO:
    - Precio actual: $${event.price.toFixed(2)}
    - EMA ${event.type === 'ema55' ? '55' : '200'}: $${event.emaValue.toFixed(2)}
    - Cambio 24h: ${parseFloat(marketData.priceChangePercent).toFixed(2)}%
    - Volumen 24h: ${parseFloat(marketData.volume).toFixed(0)} BTC
    - Precio máximo 24h: $${parseFloat(marketData.highPrice).toFixed(2)}
    - Precio mínimo 24h: $${parseFloat(marketData.lowPrice).toFixed(2)}
    
    ANÁLISIS REQUERIDO:
    1. Interpreta la significancia técnica de este evento específico
    2. Considera el contexto de la EMA ${event.type === 'ema55' ? '55 (media plazo)' : '200 (largo plazo)'}
    3. Evalúa si es una señal de continuación o reversión
    4. Proporciona una recomendación clara: LONG, SHORT o NEUTRAL
    5. Asigna un nivel de confianza (0-100)
    
    CONTEXTO TÉCNICO:
    - EMA 55: Representa tendencia de medio plazo
    - EMA 200: Representa tendencia de largo plazo
    - Toques desde arriba: Posible soporte
    - Toques desde abajo: Posible resistencia
    - Cruces: Cambios de tendencia potenciales
    
    Responde en formato JSON:
    {
      "reasoning": "Análisis detallado del evento y su significancia técnica",
      "recommendation": "LONG|SHORT|NEUTRAL",
      "confidence": 85,
      "keyPoints": ["Punto clave 1", "Punto clave 2", "Punto clave 3"]
    }
    `
    
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
  }

  // Obtener descripción legible del evento
  const getEventDescription = (event: EMATouchEvent): string => {
    const emaName = event.type === "ema55" ? "EMA 55" : "EMA 200"
    
    switch (event.direction) {
      case "touch_from_above":
        return `El precio tocó la ${emaName} desde arriba (posible soporte)`
      case "touch_from_below":
        return `El precio tocó la ${emaName} desde abajo (posible resistencia)`
      case "cross_above":
        return `El precio cruzó por encima de la ${emaName} (señal alcista)`
      case "cross_below":
        return `El precio cruzó por debajo de la ${emaName} (señal bajista)`
      default:
        return `Interacción con ${emaName}`
    }
  }

  // Obtener color del badge según la recomendación
  const getRecommendationColor = (recommendation?: string) => {
    switch (recommendation) {
      case "LONG":
        return "bg-green-500 text-white"
      case "SHORT":
        return "bg-red-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  // Obtener icono según el tipo de evento
  const getEventIcon = (direction: string) => {
    switch (direction) {
      case "cross_above":
      case "touch_from_below":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "cross_below":
      case "touch_from_above":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-blue-500" />
    }
  }

  // Efecto para actualizar datos periódicamente
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (isActive) {
      // Actualizar cada 10 segundos cuando está activo
      interval = setInterval(fetchMarketData, 10000)
      // Obtener datos iniciales
      fetchMarketData()
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, apiKeys.openai])

  return (
    <div className="space-y-4">
      {/* Panel de Control */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Análisis Automático EMA</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setIsActive(!isActive)}
                variant={isActive ? "destructive" : "default"}
                size="sm"
                disabled={!apiKeys.openai}
              >
                {isActive ? "Detener" : "Activar"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!apiKeys.openai && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Configura tu API key de OpenAI en la sección de Configuración para usar esta funcionalidad.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                ${currentPrice.toFixed(2)}
              </div>
              <div className="text-sm text-blue-600">Precio Actual</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-600">
                ${emaValues.ema55.toFixed(2)}
              </div>
              <div className="text-sm text-orange-600">EMA 55</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                ${emaValues.ema200.toFixed(2)}
              </div>
              <div className="text-sm text-purple-600">EMA 200</div>
            </div>
          </div>
          
          {isActive && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2 text-green-700">
                <Activity className="h-4 w-4 animate-pulse" />
                <span className="text-sm font-medium">
                  Monitoreando toques y cruces de EMA 55 y EMA 200...
                </span>
              </div>
            </div>
          )}
          
          {isAnalyzing && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-700">
                <Bot className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">
                  Analizando evento con IA...
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Último Análisis */}
      {lastAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Último Análisis de IA</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              value={lastAnalysis} 
              readOnly 
              className="min-h-[120px] text-sm"
            />
            <div className="text-xs text-muted-foreground mt-2">
              Última actualización: {new Date().toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de Eventos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Eventos Detectados</CardTitle>
        </CardHeader>
        <CardContent>
          {touchEvents.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se han detectado eventos aún</p>
              <p className="text-sm">Activa el monitor para detectar toques y cruces de EMAs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {touchEvents.map((event) => (
                <div key={event.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getEventIcon(event.direction)}
                      <Badge variant="outline" className="text-xs">
                        {event.type.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium">
                        {getEventDescription(event)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {event.recommendation && (
                        <Badge className={`text-xs ${getRecommendationColor(event.recommendation)}`}>
                          {event.recommendation}
                        </Badge>
                      )}
                      {event.confidence && (
                        <Badge variant="outline" className="text-xs">
                          {event.confidence}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Precio: ${event.price.toFixed(2)} | EMA: ${event.emaValue.toFixed(2)} | 
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                  
                  {event.analysis && (
                    <div className="text-sm bg-muted p-3 rounded mt-2">
                      {event.analysis}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}