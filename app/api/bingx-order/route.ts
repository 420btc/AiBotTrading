import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const { apiKey, secretKey, symbol, side, type, quantity, leverage } = await request.json()

    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: "API Key y Secret Key requeridos" }, { status: 400 })
    }

    if (!symbol || !side || !type || !quantity) {
      return NextResponse.json({ error: "Parámetros de orden incompletos" }, { status: 400 })
    }

    // Crear timestamp para la solicitud
    const timestamp = Date.now()
    
    // Parámetros para la orden de futuros perpetuos
    const orderParams = {
      symbol: symbol, // ej: "BTC-USDT"
      side: side, // "BUY" o "SELL"
      type: type, // "MARKET" o "LIMIT"
      quantity: quantity.toString(),
      positionSide: side === "BUY" ? "LONG" : "SHORT", // Requerido para futuros perpetuos
      clientOrderID: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ID único requerido
      timestamp: timestamp.toString()
    }

    // Crear query string para la firma
    const queryString = Object.keys(orderParams)
      .sort()
      .map(key => `${key}=${orderParams[key as keyof typeof orderParams]}`)
      .join('&')
    
    // Crear firma HMAC SHA256
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex')

    // Endpoint para órdenes de futuros perpetuos en BingX
    const url = `https://open-api.bingx.com/openApi/swap/v2/trade/order`
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-BX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `${queryString}&signature=${signature}`
    })

    const data = await response.json()

    if (!response.ok || data.code !== 0) {
      return NextResponse.json({ 
        error: data.msg || "Error al ejecutar la orden en BingX",
        details: data
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      orderId: data.data?.orderId,
      message: "Orden ejecutada exitosamente",
      data: data.data
    })
  } catch (error) {
    console.error("Error ejecutando orden en BingX:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}