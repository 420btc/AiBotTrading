import { Position } from "./positions-panel"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { X, TrendingUp, TrendingDown, Bot } from "lucide-react"

interface PositionCardProps {
  position: Position & { liquidationPrice?: number }
  onClose: (id: string) => void
  isAI?: boolean
}

export default function PositionCard({ position, onClose, isAI = false }: PositionCardProps) {
  const liquidationPrice = position.liquidationPrice || 
    (position.type === 'long' 
      ? position.entryPrice * (1 - 1/position.leverage)
      : position.entryPrice * (1 + 1/position.leverage))

  return (
    <div className={`p-3 border rounded-lg space-y-2 ${isAI ? 'border-blue-200 bg-blue-50/50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {position.type === "long" ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <Badge 
            variant={position.type === "long" ? "default" : "destructive"} 
            className={position.type === "long" ? "bg-green-500 text-white" : "bg-red-500 text-white"}
          >
            {position.type.toUpperCase()}
          </Badge>
          {isAI ? (
            <Badge variant="outline" className="text-xs bg-blue-100">
              <Bot className="h-3 w-3 mr-1" />
              IA
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Manual
            </Badge>
          )}
          {position.confidence && (
            <Badge variant="outline" className="text-xs">
              {position.confidence}%
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onClose(position.id)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
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
        <div className="col-span-3 md:col-span-1">
          <span className="text-muted-foreground">Liquidación:</span>
          <div className="font-semibold">
            {liquidationPrice === Infinity 
              ? 'N/A' 
              : `$${liquidationPrice.toFixed(2)}`}
          </div>
        </div>
        <div className="col-span-3 md:col-span-1">
          <span className="text-muted-foreground">PnL:</span>
          <div className={`font-semibold ${(position.pnl || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
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
        onClick={() => onClose(position.id)}
        variant={position.type === "long" ? "destructive" : "default"}
        className="w-full"
      >
        Cerrar Posición {isAI ? 'IA' : ''}
      </Button>
    </div>
  )
}
