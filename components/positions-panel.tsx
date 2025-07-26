"use client"

import { useState, useEffect, lazy, Suspense, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Importar dinámicamente el componente PositionCard
const PositionCard = lazy(() => import('./position-card'));

export interface Position {
  id: string
  type: "long" | "short"
  amount: number
  entryPrice: number
  leverage: number
  timestamp: number
  isAI?: boolean
  aiReasoning?: string
  confidence?: number
  pnl?: number,
  liquidationPrice?: number
}

interface PositionsPanelProps {
  positions: Position[]
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>
  setBalance: React.Dispatch<React.SetStateAction<number>>
}

export function PositionsPanel({ positions, setPositions, setBalance }: PositionsPanelProps) {
  const [currentPrice, setCurrentPrice] = useState(50000)
  const [positionsWithPnL, setPositionsWithPnL] = useState<Array<Position & { liquidationPrice?: number }>>([])
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Función para calcular el precio de liquidación
  const updateLiquidationPrices = (positions: Position[]) => {
    return positions.map(pos => {
      const { type, entryPrice, leverage } = pos;
      let liquidationPrice: number;
      
      if (leverage <= 1) {
        // Si el apalancamiento es 1x o menor, no hay precio de liquidación (no hay margen de mantenimiento)
        liquidationPrice = type === 'long' ? 0 : Infinity;
      } else {
        // Fórmula simplificada para el precio de liquidación
        // Para largos: Precio de entrada * (1 - 1/apalancamiento)
        // Para cortos: Precio de entrada * (1 + 1/apalancamiento)
        liquidationPrice = type === 'long' 
          ? entryPrice * (1 - 1/leverage)
          : entryPrice * (1 + 1/leverage);
        
        liquidationPrice = Math.max(0, liquidationPrice); // Aseguramos que no sea negativo
      }
      
      return {
        ...pos,
        liquidationPrice
      };
    });
  };
  
  // Efecto para inicializar los precios de liquidación cuando cambian las posiciones
  useEffect(() => {
    const updatedPositions = updateLiquidationPrices(positions);
    setPositionsWithPnL(updatedPositions);
  }, [positions]);

  // Función para verificar si una posición debe ser liquidada
  const shouldLiquidatePosition = useCallback((position: Position, currentPrice: number): boolean => {
    if (!position.liquidationPrice) return false;
    
    if (position.type === 'long') {
      // Para posiciones largas, se liquida si el precio baja al nivel de liquidación
      return currentPrice <= position.liquidationPrice;
    } else {
      // Para posiciones cortas, se liquida si el precio sube al nivel de liquidación
      return currentPrice >= position.liquidationPrice;
    }
  }, []);

  // Función para liquidar una posición (comentada porque no se usa actualmente)
  // const liquidatePosition = useCallback((positionId: string) => {
  //   setPositions(prevPositions => {
  //     const position = prevPositions.find(p => p.id === positionId);
  //     if (!position) return prevPositions;

  //     // Calcular pérdida total (el margen inicial se pierde)
  //     const initialMargin = position.amount / position.leverage;
  //     const loss = -initialMargin; // Se pierde todo el margen inicial

  //     // Actualizar el balance
  //     setBalance(prev => prev + loss);

  //     console.log(`Posición ${positionId} liquidada automáticamente. Pérdida: $${Math.abs(loss).toFixed(2)}`);
      
  //     // Retornar las posiciones sin la posición liquidada
  //     return prevPositions.filter(p => p.id !== positionId);
  //   });
  // }, [setBalance, setPositions]);

  // Función para calcular el PnL de una posición
  const calculatePositionPnL = (position: Position, currentPrice: number): number => {
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
        return 0;
      }
      
      // Calcular diferencia de precio según tipo de posición
      const priceDiff = position.type === "long" 
        ? currentPrice - position.entryPrice 
        : position.entryPrice - currentPrice;

      // Calcular PnL
      const pnlPercentage = (priceDiff / position.entryPrice) * 100;
      const pnl = ((position.amount * pnlPercentage) / 100) * position.leverage;
      
      return isFinite(pnl) ? pnl : 0;
    } catch (err) {
      console.error("Error calculando PnL para posición:", err);
      return 0;
    }
  };

  // Función mejorada para actualizar precios con mejor manejo de errores
  const updatePrices = useCallback(async () => {
    try {
      // Intentar obtener el precio actual de Bitcoin
      const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");

      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Validar que la respuesta tenga la estructura esperada
      if (!data || !data.price) {
        throw new Error("Formato de respuesta inválido");
      }

      // Convertir el precio a número y validar
      const price = Number.parseFloat(data.price);

      if (isNaN(price) || !isFinite(price) || price <= 0) {
        throw new Error("Precio inválido recibido");
      }

      // Actualizar el precio y limpiar errores previos
      setCurrentPrice(price);
      setUpdateError(null);
      setLastUpdateTime(new Date());

      // Actualizar posiciones con el nuevo PnL
      setPositions(prevPositions => {
        const updatedPositions = prevPositions.map(position => {
          // Calcular PnL para cada posición
          const pnl = calculatePositionPnL(position, price);
          
          // Verificar si la posición debe ser liquidada
          if (shouldLiquidatePosition(position, price)) {
            // Si la posición debe ser liquidada, calcular la pérdida
            const initialMargin = position.amount / position.leverage;
            const loss = -initialMargin;
            
            // Actualizar el balance
            setBalance(prev => prev + loss);
            
            console.log(`Posición ${position.id} liquidada automáticamente. Pérdida: $${Math.abs(loss).toFixed(2)}`);
            
            // Retornar null para filtrar esta posición
            return null;
          }
          
          // Retornar la posición actualizada con el nuevo PnL
          return {
            ...position,
            pnl,
            liquidationPrice: position.liquidationPrice || 
              (position.type === 'long' 
                ? position.entryPrice * (1 - 1/position.leverage)
                : position.entryPrice * (1 + 1/position.leverage))
          };
        }).filter(Boolean) as Position[]; // Filtrar posiciones nulas (las liquidadas)


        return updatedPositions;
      });

      // Actualizar el estado de positionsWithPnL para reflejar los cambios
      setPositionsWithPnL(prevPositions => {
        return prevPositions
          .filter(pos => positions.some(p => p.id === pos.id)) // Solo mantener posiciones que aún existen
          .map(pos => {
            const position = positions.find(p => p.id === pos.id);
            if (!position) return pos;
            
            return {
              ...pos,
              pnl: calculatePositionPnL(position, price),
              liquidationPrice: position.liquidationPrice
            };
          });
      });
    } catch (err) {
      console.error("Error actualizando precios:", err);
      setUpdateError(err instanceof Error ? err.message : "Error desconocido al actualizar precios");
    }
  }, [positions, shouldLiquidatePosition, setBalance, setPositions]);

  // Efecto para actualizar precios periódicamente
  useEffect(() => {
    // Actualizar inmediatamente al montar
    updatePrices();
    
    // Configurar intervalo para actualizaciones cada segundo (1000ms)
    const intervalId = setInterval(updatePrices, 1000);
    
    // Limpiar intervalo al desmontar
    return () => clearInterval(intervalId);
  }, [updatePrices]);
  
  // Calcular posiciones y PnL total de manera eficiente
  const { aiPositions, manualPositions, totalPnL } = useMemo(() => {
    const ai: Position[] = [];
    const manual: Position[] = [];
    let total = 0;

    positionsWithPnL.forEach(pos => {
      // Calcular PnL para la posición actual
      const pnl = pos.pnl || 0;
      if (!isNaN(pnl)) {
        total += pnl;
      }
      
      // Clasificar la posición
      if (pos.isAI) {
        ai.push(pos);
      } else {
        manual.push(pos);
      }
    });
    
    return { 
      aiPositions: ai, 
      manualPositions: manual, 
      totalPnL: total 
    };
  }, [positionsWithPnL]);

  // Función mejorada para cerrar posición con validaciones
  const closePosition = useCallback((positionId: string) => {
    try {
      const position = positionsWithPnL.find((p: Position) => p.id === positionId);
      if (!position) {
        console.error("Posición no encontrada:", positionId);
        return;
      }

      const profit = position.pnl || 0;
      const initialInvestment = position.amount / position.leverage;

      // Validar cálculos
      if (isNaN(profit) || isNaN(initialInvestment) || initialInvestment <= 0) {
        console.error("Cálculos inválidos al cerrar posición:", { profit, initialInvestment });
        return;
      }

      // Actualizar balance y posiciones
      setBalance((prev: number) => prev + initialInvestment + profit);
      setPositions((prev: Position[]) => prev.filter((p: Position) => p.id !== positionId));

      console.log(`Posición cerrada: ${profit > 0 ? "Ganancia" : "Pérdida"} de $${profit.toFixed(2)}`);
    } catch (error) {
      console.error("Error al cerrar posición:", error);
    }
  }, [positionsWithPnL, setBalance, setPositions]);

  // Las variables ya están definidas en el useMemo anterior

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
                <Suspense fallback={<div>Cargando posiciones...</div>}>
                  {aiPositions.map((position) => (
                    <PositionCard 
                      key={position.id} 
                      position={position} 
                      onClose={closePosition}
                      isAI={true}
                    />
                  ))}
                </Suspense>
              </div>
            )}

            {/* Posiciones Manuales */}
            {manualPositions.length > 0 && (
              <div className="space-y-2">
                {aiPositions.length > 0 && <div className="border-t pt-2" />}
                <div className="flex items-center space-x-2 text-sm font-semibold">
                  <span>👤 Posiciones Manuales ({manualPositions.length})</span>
                </div>
                <Suspense fallback={<div>Cargando posiciones...</div>}>
                  {manualPositions.map((position) => (
                    <PositionCard 
                      key={position.id} 
                      position={position} 
                      onClose={closePosition}
                      isAI={false}
                    />
                  ))}
                </Suspense>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
