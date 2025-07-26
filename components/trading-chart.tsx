"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"

interface TradingChartProps {
  apiKeys: { openai?: string }
}

export function TradingChart({ apiKeys }: TradingChartProps) {
  const tradingViewRef = useRef<HTMLDivElement>(null)
  const [currentPrice, setCurrentPrice] = useState(0)
  const [priceChange24h, setPriceChange24h] = useState(0)
  const [volume24h, setVolume24h] = useState(0)
  const [high24h, setHigh24h] = useState(0)
  const [low24h, setLow24h] = useState(0)
  const [apiError, setApiError] = useState<string | null>(null)

  // Obtener datos de mercado de Binance
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
        const data = await response.json()
        
        if (data && !data.code) {
          setCurrentPrice(parseFloat(data.lastPrice))
          setPriceChange24h(parseFloat(data.priceChangePercent))
          setVolume24h(parseFloat(data.volume))
          setHigh24h(parseFloat(data.highPrice))
          setLow24h(parseFloat(data.lowPrice))
          setApiError(null)
        }
      } catch (error) {
        console.error("Error obteniendo datos de mercado:", error)
        setApiError("Error obteniendo datos de Binance")
      }
    }

    // Obtener datos iniciales
    fetchMarketData()
    
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchMarketData, 30000)
    
    return () => clearInterval(interval)
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
      "backgroundColor": "#1e1e2e",
      "gridColor": "#363c4e",
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
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
        "paneProperties.background": "#1e1e2e",
        "paneProperties.backgroundType": "solid",
        "paneProperties.vertGridProperties.color": "#363c4e",
        "paneProperties.horzGridProperties.color": "#363c4e",
        "symbolWatermarkProperties.transparency": 90,
        "scalesProperties.textColor": "#d9d9d9",
        "scalesProperties.backgroundColor": "#1e1e2e",
        "mainSeriesProperties.candleStyle.upColor": "#00d4aa",
        "mainSeriesProperties.candleStyle.downColor": "#ff6b6b",
        "mainSeriesProperties.candleStyle.borderUpColor": "#00d4aa",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ff6b6b",
        "mainSeriesProperties.candleStyle.wickUpColor": "#00d4aa",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ff6b6b",
        "paneProperties.topMargin": 10,
        "paneProperties.bottomMargin": 10
      }
    })

    tradingViewRef.current.appendChild(script)
  }, [])













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
        className="w-full border rounded bg-[#1e1e2e]"
        style={{ 
          height: "400px",
          backgroundColor: "#1e1e2e",
          border: "1px solid #363c4e"
        }}
      >
        <div className="flex items-center justify-center h-full text-gray-300">
          Cargando gráfico de TradingView...
        </div>
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
                {priceChange24h >= 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
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
  )
}
