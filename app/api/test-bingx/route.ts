import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const { apiKey, secretKey } = await request.json()

    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: "API Key y Secret Key requeridos" }, { status: 400 })
    }

    // Crear timestamp para la solicitud
    const timestamp = Date.now()
    const queryString = `timestamp=${timestamp}`
    
    // Crear firma HMAC SHA256
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex')

    // Probar conexión con endpoint de información de cuenta
    const response = await fetch(`https://open-api.bingx.com/openApi/spot/v1/account/balance?${queryString}&signature=${signature}`, {
      method: "GET",
      headers: {
        "X-BX-APIKEY": apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ 
        error: error.msg || "Error de autenticación con BingX" 
      }, { status: 400 })
    }

    const data = await response.json()
    
    // Verificar que la respuesta sea exitosa
    if (data.code !== 0) {
      return NextResponse.json({ 
        error: data.msg || "Error en la respuesta de BingX" 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: "Conexión exitosa con BingX",
      hasBalance: data.data && data.data.balances && data.data.balances.length > 0
    })
  } catch (error) {
    console.error("Error probando BingX:", error)
    return NextResponse.json({ error: "Error de conexión con BingX" }, { status: 500 })
  }
}