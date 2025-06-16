"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface IndicatorData {
  ema10: number
  ema55: number
  ema200: number
  ema365: number
  macd: { value: number; signal: number; histogram: number }
  rsi: number
  volume: number
  price: number
}

export function IndicatorsPanel() {
  const [indicators, setIndicators] = useState<IndicatorData>({
    ema10: 0,
    ema55: 0,
    ema200: 0,
    ema365: 0,
    macd: { value: 0, signal: 0, histogram: 0 },
    rsi: 50,
    volume: 0,
    price: 0,
  })

  useEffect(() => {
    // Simular cálculo de indicadores con datos reales
    const updateIndicators = () => {
      // En una implementación real, estos valores vendrían del cálculo de indicadores
      setIndicators({
        ema10: 49850.23,
        ema55: 49200.45,
        ema200: 48500.12,
        ema365: 47800.89,
        macd: { value: 125.45, signal: 98.23, histogram: 27.22 },
        rsi: 65.8,
        volume: 1250000,
        price: 50000,
      })
    }

    updateIndicators()
    const interval = setInterval(updateIndicators, 5000)
    return () => clearInterval(interval)
  }, [])

  const getRSIColor = (rsi: number) => {
    if (rsi > 70) return "text-red-500"
    if (rsi < 30) return "text-green-500"
    return "text-yellow-500"
  }

  const getEMASignal = () => {
    const { ema10, ema55, ema200, price } = indicators
    if (price > ema10 && ema10 > ema55 && ema55 > ema200) return "Alcista Fuerte"
    if (price > ema10 && ema10 > ema55) return "Alcista"
    if (price < ema10 && ema10 < ema55 && ema55 < ema200) return "Bajista Fuerte"
    if (price < ema10 && ema10 < ema55) return "Bajista"
    return "Neutral"
  }

  const getMACDSignal = () => {
    const { macd } = indicators
    if (macd.value > macd.signal && macd.histogram > 0) return "Compra"
    if (macd.value < macd.signal && macd.histogram < 0) return "Venta"
    return "Neutral"
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Análisis Técnico</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* EMAs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Medias Móviles (EMA)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">EMA 10:</span>
              <Badge variant="outline">${indicators.ema10.toFixed(2)}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">EMA 55:</span>
              <Badge variant="outline">${indicators.ema55.toFixed(2)}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">EMA 200:</span>
              <Badge variant="outline">${indicators.ema200.toFixed(2)}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">EMA 365:</span>
              <Badge variant="outline">${indicators.ema365.toFixed(2)}</Badge>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Señal:</span>
                <Badge
                  variant={
                    getEMASignal().includes("Alcista")
                      ? "default"
                      : getEMASignal().includes("Bajista")
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {getEMASignal()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RSI */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">RSI (14)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getRSIColor(indicators.rsi)}`}>{indicators.rsi.toFixed(1)}</div>
              <Progress value={indicators.rsi} className="mt-2" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-green-500 font-semibold">Sobreventa</div>
                <div>{"< 30"}</div>
              </div>
              <div className="text-center">
                <div className="text-yellow-500 font-semibold">Neutral</div>
                <div>30-70</div>
              </div>
              <div className="text-center">
                <div className="text-red-500 font-semibold">Sobrecompra</div>
                <div>{"> 70"}</div>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Estado:</span>
                <Badge variant={indicators.rsi > 70 ? "destructive" : indicators.rsi < 30 ? "default" : "secondary"}>
                  {indicators.rsi > 70 ? "Sobrecompra" : indicators.rsi < 30 ? "Sobreventa" : "Neutral"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MACD */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">MACD</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">MACD:</span>
              <Badge variant="outline">{indicators.macd.value.toFixed(2)}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Señal:</span>
              <Badge variant="outline">{indicators.macd.signal.toFixed(2)}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Histograma:</span>
              <Badge variant={indicators.macd.histogram > 0 ? "default" : "destructive"}>
                {indicators.macd.histogram.toFixed(2)}
              </Badge>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Señal:</span>
                <Badge
                  variant={
                    getMACDSignal() === "Compra" ? "default" : getMACDSignal() === "Venta" ? "destructive" : "secondary"
                  }
                >
                  {getMACDSignal()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volumen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Volumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{(indicators.volume / 1000000).toFixed(2)}M</div>
              <div className="text-sm text-muted-foreground">BTC</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>24h Promedio:</span>
                <span>1.8M BTC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estado:</span>
                <Badge variant={indicators.volume > 1800000 ? "default" : "secondary"}>
                  {indicators.volume > 1800000 ? "Alto" : "Normal"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen General */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Resumen de Señales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">EMA</div>
                <Badge
                  variant={
                    getEMASignal().includes("Alcista")
                      ? "default"
                      : getEMASignal().includes("Bajista")
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {getEMASignal()}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">RSI</div>
                <Badge variant={indicators.rsi > 70 ? "destructive" : indicators.rsi < 30 ? "default" : "secondary"}>
                  {indicators.rsi > 70 ? "Sobrecompra" : indicators.rsi < 30 ? "Sobreventa" : "Neutral"}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">MACD</div>
                <Badge
                  variant={
                    getMACDSignal() === "Compra" ? "default" : getMACDSignal() === "Venta" ? "destructive" : "secondary"
                  }
                >
                  {getMACDSignal()}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Volumen</div>
                <Badge variant={indicators.volume > 1800000 ? "default" : "secondary"}>
                  {indicators.volume > 1800000 ? "Alto" : "Normal"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
