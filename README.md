# Bitcoin Trading Platform

Una plataforma de trading de Bitcoin moderna y completa construida con Next.js, React y TypeScript.

## Características

- 📈 **Gráficos de Trading en Tiempo Real**: Visualización avanzada de datos de mercado
- 🤖 **Análisis con IA**: Integración con OpenAI para análisis inteligente del mercado
- 📊 **Indicadores Técnicos**: Amplia gama de indicadores para análisis técnico
- 💼 **Gestión de Posiciones**: Seguimiento y gestión de posiciones de trading
- ⚙️ **Panel de Configuración**: Configuración personalizable de la plataforma
- 🌙 **Modo Oscuro/Claro**: Interfaz adaptable con soporte para temas
- 📱 **Diseño Responsivo**: Optimizado para dispositivos móviles y desktop

## Tecnologías Utilizadas

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: Radix UI, Tailwind CSS
- **Gráficos**: Recharts
- **Iconos**: Lucide React
- **Temas**: next-themes
- **IA**: OpenAI API

## Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/420btc/AiBotTrading.git
cd AiBotTrading
```

2. Instala las dependencias:
```bash
npm install
# o
yarn install
# o
pnpm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env.local
```

Agrega tu API key de OpenAI en el archivo `.env.local`:
```
OPENAI_API_KEY=tu_api_key_aqui
```

4. Ejecuta el servidor de desarrollo:
```bash
npm run dev
# o
yarn dev
# o
pnpm dev
```

5. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Estructura del Proyecto

```
├── app/                    # App Router de Next.js
│   ├── api/               # API routes
│   ├── globals.css        # Estilos globales
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Página principal
├── components/            # Componentes React
│   ├── ui/               # Componentes UI base
│   ├── ai-trading-panel.tsx
│   ├── indicators-panel.tsx
│   ├── positions-panel.tsx
│   ├── settings-panel.tsx
│   ├── trading-chart.tsx
│   └── trading-panel.tsx
├── hooks/                 # Custom hooks
├── lib/                   # Utilidades
└── public/               # Archivos estáticos
```

## Componentes Principales

### TradingChart
Componente principal para mostrar gráficos de trading con datos en tiempo real.

### TradingPanel
Panel de trading para ejecutar órdenes de compra y venta.

### AITradingPanel
Panel de análisis con IA que utiliza OpenAI para proporcionar insights del mercado.

### IndicatorsPanel
Panel de indicadores técnicos para análisis avanzado.

### PositionsPanel
Gestión y seguimiento de posiciones abiertas.

## API Routes

- `/api/ai-analysis` - Análisis de mercado con IA
- `/api/test-openai` - Prueba de conexión con OpenAI

## Configuración

La plataforma permite configurar:
- API keys (OpenAI)
- Preferencias de trading
- Configuración de gráficos
- Temas y apariencia

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Contacto

Para preguntas o soporte, por favor abre un issue en GitHub.

---

⚠️ **Disclaimer**: Esta plataforma es solo para fines educativos y de demostración. No constituye asesoramiento financiero. Siempre haz tu propia investigación antes de realizar cualquier inversión.