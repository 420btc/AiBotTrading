"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, TrendingUp, TrendingDown, AlertTriangle, Bot } from "lucide-react"

interface Position {
  id: string
  type: "long" | "short"
  amount: number
  entryPrice: number
  leverage: number
  timestamp: number
  isAI?: boolean
  aiReasoning?: string
  confidence?: number
  pnl?: number
}

interface PositionsPanelProps {
  positions: Position[]
  setPositions: (positions: Position[]) => void
  setBalance: (balance: number) => void
}

export function PositionsPanel({ positions, setPositions, setBalance }: PositionsPanelProps) {
  const [currentPrice, setCurrentPrice] = useState(50000)
  const [positionsWithPnL, setPositionsWithPnL] = useState<Position[]>([])
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Función mejorada para actualizar precios con mejor manejo de errores
  useEffect(() => {
    const updatePrices = async () => {
      try {
        // Intentar obtener el precio actual de Bitcoin
        const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")

        // Verificar si la respuesta es exitosa
        if (!response.ok) {
          throw new Error(`Error en la API: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        // Validar que la respuesta tenga la estructura esperada
        if (!data || !data.price) {
          throw new Error("Formato de respuesta inválido")
        }

        // Convertir el precio a número y validar
        const price = Number.parseFloat(data.price)

        if (isNaN(price) || !isFinite(price) || price <= 0) {
          throw new Error("Precio inválido recibido")
        }

        // Actualizar el precio y limpiar errores previos
        setCurrentPrice(price)
        setUpdateError(null)
        setLastUpdateTime(new Date())

        // Calcular PnL para cada posición con validaciones
        const updatedPositions = positions.map((position) => {
          try {
            // Validar datos de la posición
            if (
              isNaN(position.entryPrice) ||
              position.entryPrice <= 0 ||
              isNaN(position.amount) ||
              position.amount <= 0 ||
              isNaN(position.leverage) ||
              position.leverage <= 0
            ) {
              return { ...position, pnl: 0 }
            }

            // Calcular diferencia de precio según tipo de posición
            const priceDiff = position.type === "long" ? price - position.entryPrice : position.entryPrice - price

            // Calcular PnL con validaciones
            const pnlPercentage = (priceDiff / position.entryPrice) * 100
            const pnl = ((position.amount * pnlPercentage) / 100) * position.leverage

            return {
              ...position,
              pnl: isNaN(pnl) ? 0 : pnl,
            }
          } catch (err) {
            console.error("Error calculando PnL para posición:", err)
            return { ...position, pnl: 0 }
          }
        })

        setPositionsWithPnL(updatedPositions)
      } catch (error) {
        // Manejar el error y mostrar mensaje
        console.error("Error actualizando precios:", error)
        setUpdateError(error instanceof Error ? error.message : "Error desconocido")

        // Usar el último precio conocido o un valor predeterminado
        // No actualizamos el precio aquí para mantener el último valor válido

        // Actualizar posiciones con el último precio conocido
        const updatedPositions = positions.map((position) => {
          return { ...position, pnl: position.pnl || 0 }
        })

        setPositionsWithPnL(updatedPositions)
      }
    }

    // Ejecutar la actualización inmediatamente
    updatePrices()

    // Configurar intervalo para actualizaciones periódicas
    const interval = setInterval(updatePrices, 5000)

    // Limpiar intervalo al desmontar
    return () => clearInterval(interval)
  }, [positions])

  // Función mejorada para cerrar posición con validaciones
  const closePosition = (positionId: string) => {
    try {
      const position = positionsWithPnL.find((p) => p.id === positionId)
      if (!position) {
        console.error("Posición no encontrada:", positionId)
        return
      }

      const profit = position.pnl || 0
      const initialInvestment = position.amount / position.leverage

      // Validar cálculos
      if (isNaN(profit) || isNaN(initialInvestment) || initialInvestment <= 0) {
        console.error("Cálculos inválidos al cerrar posición:", { profit, initialInvestment })
        return
      }

      // Actualizar balance y posiciones
      setBalance((prev) => prev + initialInvestment + profit)
      setPositions(positions.filter((p) => p.id !== positionId))

      console.log(`Posición cerrada: ${profit > 0 ? "Ganancia" : "Pérdida"} de $${profit.toFixed(2)}`)
    } catch (error) {
      console.error("Error al cerrar posición:", error)
    }
  }

  // Calcular PnL total con validación
  const totalPnL = positionsWithPnL.reduce((sum, pos) => {
    const pnl = pos.pnl || 0
    return isNaN(pnl) ? sum : sum + pnl
  }, 0)

  // Separar posiciones de IA y manuales
  const aiPositions = positionsWithPnL.filter((pos) => pos.isAI)
  const manualPositions = positionsWithPnL.filter((pos) => !pos.isAI)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Posiciones ({positionsWithPnL.length})</span>
          <Badge variant={totalPnL >= 0 ? "default" : "destructive"}>
            {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
          </Badge>
        </CardTitle>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Precio BTC: <span className="font-semibold">${currentPrice.toFixed(2)}</span>
          </div>
          {lastUpdateTime && (
            <div className="text-xs text-muted-foreground">Actualizado: {lastUpdateTime.toLocaleTimeString()}</div>
          )}
        </div>

        {/* Mostrar error si existe */}
        {updateError && (
          <div className="mt-2 p-2 bg-red-50 text-red-600 rounded-md flex items-center text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            <span>Error: {updateError}</span>
          </div>
        )}

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center space-x-1">
            <Bot className="h-3 w-3" />
            <span>IA: {aiPositions.length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>👤 Manual: {manualPositions.length}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {positionsWithPnL.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No hay posiciones activas</p>
          </div>
        ) : (
          <>
            {/* Posiciones de IA */}
            {aiPositions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm font-semibold text-blue-600">
                  <Bot className="h-4 w-4" />
                  <span>Posiciones de IA ({aiPositions.length})</span>
                </div>
                {aiPositions.map((position) => (
                  <div key={position.id} className="p-3 border-2 border-blue-200 rounded-lg space-y-2 bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {position.type === "long" ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant={position.type === "long" ? "default" : "destructive"}>
                          {position.type.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-blue-100">
                          <Bot className="h-3 w-3 mr-1" />
                          IA
                        </Badge>
                        {position.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {position.confidence}%
                          </Badge>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => closePosition(position.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cantidad:</span>
                        <div className="font-semibold">${position.amount}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Apalancamiento:</span>
                        <div className="font-semibold">{position.leverage}x</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Precio entrada:</span>
                        <div className="font-semibold">${position.entryPrice.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">PnL:</span>
                        <div
                          className={`font-semibold ${(position.pnl || 0) >= 0 ? "text-green-500" : "text-red-500"}`}
                        >
                          {(position.pnl || 0) >= 0 ? "+" : ""}${(position.pnl || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {position.aiReasoning && (
                      <div className="text-xs text-muted-foreground bg-white p-2 rounded border">
                        <strong>Análisis IA:</strong> {position.aiReasoning.substring(0, 100)}...
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Abierta: {new Date(position.timestamp).toLocaleString()}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => closePosition(position.id)}
                      variant={position.type === "long" ? "destructive" : "default"}
                      className="w-full"
                    >
                      Cerrar Posición IA
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Posiciones Manuales */}
            {manualPositions.length > 0 && (
              <div className="space-y-2">
                {aiPositions.length > 0 && <div className="border-t pt-2" />}
                <div className="flex items-center space-x-2 text-sm font-semibold">
                  <span>👤 Posiciones Manuales ({manualPositions.length})</span>
                </div>
                {manualPositions.map((position) => (
                  <div key={position.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {position.type === "long" ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant={position.type === "long" ? "default" : "destructive"}>
                          {position.type.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Manual
                        </Badge>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => closePosition(position.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cantidad:</span>
                        <div className="font-semibold">${position.amount}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Apalancamiento:</span>
                        <div className="font-semibold">{position.leverage}x</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Precio entrada:</span>
                        <div className="font-semibold">${position.entryPrice.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">PnL:</span>
                        <div
                          className={`font-semibold ${(position.pnl || 0) >= 0 ? "text-green-500" : "text-red-500"}`}
                        >
                          {(position.pnl || 0) >= 0 ? "+" : ""}${(position.pnl || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Abierta: {new Date(position.timestamp).toLocaleString()}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => closePosition(position.id)}
                      variant={position.type === "long" ? "destructive" : "default"}
                      className="w-full"
                    >
                      Cerrar Posición
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
