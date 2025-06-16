"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown } from "lucide-react"

interface Position {
  id: string
  type: "long" | "short"
  amount: number
  entryPrice: number
  leverage: number
  timestamp: number
  pnl?: number
}

interface TradingPanelProps {
  balance: number
  setBalance: React.Dispatch<React.SetStateAction<number>>
  positions: Position[]
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>
}

export function TradingPanel({ balance, setBalance, positions, setPositions }: TradingPanelProps) {
  const [orderType, setOrderType] = useState<"market" | "limit">("market")
  const [positionType, setPositionType] = useState<"long" | "short">("long")
  const [amount, setAmount] = useState("")
  const [leverage, setLeverage] = useState("1")
  const [limitPrice, setLimitPrice] = useState("")
  const [currentPrice, setCurrentPrice] = useState(50000) // Se actualizará con datos reales

  const executeOrder = async () => {
    if (!amount || Number.parseFloat(amount) <= 0 || isNaN(Number.parseFloat(amount))) {
      alert("Por favor ingresa una cantidad válida")
      return
    }

    const orderAmount = Number.parseFloat(amount)
    const orderLeverage = Number.parseInt(leverage)

    if (isNaN(orderAmount) || isNaN(orderLeverage)) {
      alert("Valores inválidos en la orden")
      return
    }

    const totalCost = orderAmount / orderLeverage

    if (totalCost > balance || isNaN(totalCost)) {
      alert("Fondos insuficientes o cálculo inválido")
      return
    }

    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
      const data = await response.json()
      const price = Number.parseFloat(data.price)

      if (isNaN(price)) {
        alert("Error obteniendo precio actual")
        return
      }

      setCurrentPrice(price)

      const newPosition: Position = {
        id: Date.now().toString(),
        type: positionType,
        amount: orderAmount,
        entryPrice: orderType === "market" ? price : Number.parseFloat(limitPrice) || price,
        leverage: orderLeverage,
        timestamp: Date.now(),
      }

      setPositions((prev: Position[]) => [...prev, newPosition])
      setBalance((prev: number) => prev - totalCost)
      setAmount("")

      console.log(`Orden ejecutada: ${positionType.toUpperCase()} ${orderAmount} BTC a $${newPosition.entryPrice}`)
    } catch (error) {
      console.error("Error ejecutando orden:", error)
      alert("Error ejecutando la orden")
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Panel de Trading</CardTitle>
        <div className="text-sm text-muted-foreground">
          Balance: <span className="font-semibold text-green-500">${balance.toFixed(2)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={positionType === "long" ? "default" : "outline"}
            onClick={() => setPositionType("long")}
            className="flex items-center space-x-2"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Long</span>
          </Button>
          <Button
            variant={positionType === "short" ? "default" : "outline"}
            onClick={() => setPositionType("short")}
            className="flex items-center space-x-2"
          >
            <TrendingDown className="h-4 w-4" />
            <span>Short</span>
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Tipo de Orden</Label>
          <Select value={orderType} onValueChange={(value: "market" | "limit") => setOrderType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="market">Mercado</SelectItem>
              <SelectItem value="limit">Límite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {orderType === "limit" && (
          <div className="space-y-2">
            <Label>Precio Límite</Label>
            <Input
              type="number"
              placeholder="Precio en USD"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Cantidad (USD)</Label>
          <Input
            type="number"
            placeholder="Cantidad a invertir"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Apalancamiento</Label>
          <Select value={leverage} onValueChange={setLeverage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1x</SelectItem>
              <SelectItem value="2">2x</SelectItem>
              <SelectItem value="5">5x</SelectItem>
              <SelectItem value="10">10x</SelectItem>
              <SelectItem value="20">20x</SelectItem>
              <SelectItem value="50">50x</SelectItem>
              <SelectItem value="100">100x</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          <div>
            Precio actual: <span className="font-semibold">${currentPrice.toFixed(2)}</span>
          </div>
          {amount && (
            <div>
              Costo total:{" "}
              <span className="font-semibold">
                ${(Number.parseFloat(amount) / Number.parseInt(leverage)).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <Button onClick={executeOrder} className="w-full" variant={positionType === "long" ? "default" : "destructive"}>
          {positionType === "long" ? "Comprar" : "Vender"} BTC
        </Button>

        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-2">Posiciones Activas</h3>
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay posiciones activas</p>
          ) : (
            <div className="space-y-2">
              {positions.slice(-3).map((position) => (
                <div key={position.id} className="p-2 border rounded text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant={position.type === "long" ? "default" : "destructive"}>
                      {position.type.toUpperCase()}
                    </Badge>
                    <span className="font-semibold">{position.leverage}x</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${position.amount} @ ${position.entryPrice.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
