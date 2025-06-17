export interface Position {
  id: string;
  type: "long" | "short";
  amount: number;
  entryPrice: number;
  leverage: number;
  timestamp: number;
  isAI?: boolean;
  aiReasoning?: string;
  confidence?: number;
  pnl?: number;
}

export const calculateLiquidationPrice = (position: Position): number => {
  const { type, entryPrice, leverage } = position;
  
  if (leverage <= 1) {
    // Si el apalancamiento es 1x o menor, no hay precio de liquidación (no hay margen de mantenimiento)
    return type === 'long' ? 0 : Infinity;
  }
  
  // Fórmula simplificada para el precio de liquidación
  // Para largos: Precio de entrada * (1 - 1/apalancamiento)
  // Para cortos: Precio de entrada * (1 + 1/apalancamiento)
  const liquidationPrice = type === 'long' 
    ? entryPrice * (1 - 1/leverage)
    : entryPrice * (1 + 1/leverage);
  
  return Math.max(0, liquidationPrice); // Aseguramos que no sea negativo
};

export const addLiquidationPriceToPosition = (position: Position) => {
  return {
    ...position,
    liquidationPrice: calculateLiquidationPrice(position)
  };
};

export const addLiquidationPriceToPositions = (positions: Position[]) => {
  return positions.map(addLiquidationPriceToPosition);
};
