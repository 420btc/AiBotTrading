"use client"

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface BitcoinData {
  timestamp: number
  price: number
  volume: number
  high: number
  low: number
  open: number
  close: number
}

interface ChartProps {
  data: BitcoinData[]
  width: number
  height: number
}

// Gráfico de línea de precio
const PriceLineChart: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 10, bottom: 30, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.timestamp)) as [Date, Date])
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.price) as [number, number])
      .range([innerHeight, 0])

    const line = d3.line<BitcoinData>()
      .x(d => xScale(new Date(d.timestamp)))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#f7931a')
      .attr('stroke-width', 2)
      .attr('d', line)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(3).tickFormat((d) => d3.timeFormat('%H:%M')(d as Date)))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico de barras de volumen
const VolumeBarChart: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 10, bottom: 30, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xScale = d3.scaleBand()
      .domain(data.map((_, i) => i.toString()))
      .range([0, innerWidth])
      .padding(0.1)

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.volume) || 0])
      .range([innerHeight, 0])

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => xScale(i.toString()) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', d => yScale(d.volume))
      .attr('height', d => innerHeight - yScale(d.volume))
      .attr('fill', '#4ade80')

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xScale.domain().filter((_, i) => i % 5 === 0)))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico de velas (Candlestick)
const CandlestickChart: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 10, bottom: 30, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xScale = d3.scaleBand()
      .domain(data.map((_, i) => i.toString()))
      .range([0, innerWidth])
      .padding(0.3)

    const yScale = d3.scaleLinear()
      .domain([d3.min(data, d => d.low) || 0, d3.max(data, d => d.high) || 0])
      .range([innerHeight, 0])

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const candleWidth = xScale.bandwidth()

    data.forEach((d, i) => {
      const x = (xScale(i.toString()) || 0) + candleWidth / 2
      const isGreen = d.close > d.open
      
      // Línea vertical (high-low)
      g.append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', yScale(d.high))
        .attr('y2', yScale(d.low))
        .attr('stroke', isGreen ? '#22c55e' : '#ef4444')
        .attr('stroke-width', 1)

      // Rectángulo del cuerpo
      g.append('rect')
        .attr('x', x - candleWidth / 4)
        .attr('y', yScale(Math.max(d.open, d.close)))
        .attr('width', candleWidth / 2)
        .attr('height', Math.abs(yScale(d.open) - yScale(d.close)))
        .attr('fill', isGreen ? '#22c55e' : '#ef4444')
    })

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xScale.domain().filter((_, i) => i % 5 === 0)))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico de área
const AreaChart: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 10, bottom: 30, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.timestamp)) as [Date, Date])
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.price) as [number, number])
      .range([innerHeight, 0])

    const area = d3.area<BitcoinData>()
      .x(d => xScale(new Date(d.timestamp)))
      .y0(innerHeight)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#gradient)')
      .attr('d', area)

    // Gradiente
    const defs = svg.append('defs')
    const gradient = defs.append('linearGradient')
      .attr('id', 'gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', innerHeight)

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f7931a')
      .attr('stop-opacity', 0.8)

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f7931a')
      .attr('stop-opacity', 0.1)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(3).tickFormat((d) => d3.timeFormat('%H:%M')(d as Date)))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico de dispersión
const ScatterPlot: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 10, bottom: 30, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.volume) as [number, number])
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.price) as [number, number])
      .range([innerHeight, 0])

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    g.selectAll('.dot')
      .data(data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.volume))
      .attr('cy', d => yScale(d.price))
      .attr('r', 3)
      .attr('fill', '#8b5cf6')
      .attr('opacity', 0.7)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(4))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico de histograma
const Histogram: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 10, bottom: 30, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const prices = data.map(d => d.price)
    const histogram = d3.histogram()
      .domain(d3.extent(prices) as [number, number])
      .thresholds(10)

    const bins = histogram(prices)

    const xScale = d3.scaleLinear()
      .domain(d3.extent(prices) as [number, number])
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length) || 0])
      .range([innerHeight, 0])

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    g.selectAll('.bar')
      .data(bins)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.x0 || 0))
      .attr('width', d => Math.max(0, xScale(d.x1 || 0) - xScale(d.x0 || 0) - 1))
      .attr('y', d => yScale(d.length))
      .attr('height', d => innerHeight - yScale(d.length))
      .attr('fill', '#06b6d4')

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(4))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

export default function BitcoinChartsGrid() {
  const [data, setData] = useState<BitcoinData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBitcoinData = async () => {
      try {
        setLoading(true)
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=50')
        
        if (!response.ok) {
          throw new Error('Error al obtener datos de Bitcoin')
        }

        const rawData = await response.json()
        const formattedData: BitcoinData[] = rawData.map((item: any[]) => ({
          timestamp: item[0],
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
          price: parseFloat(item[4]) // Usar precio de cierre como precio principal
        }))

        setData(formattedData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    fetchBitcoinData()
    const interval = setInterval(fetchBitcoinData, 30000) // Actualizar cada 30 segundos

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">Cargando gráficos de Bitcoin...</div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">Error: {error}</div>
      </Card>
    )
  }

  // Hacer los gráficos responsivos - ocuparán el 100% del contenedor
  const chartWidth = 400
  const chartHeight = 300

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Análisis Avanzado de Bitcoin</h3>
      
      {/* Primera fila */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Precio (Línea)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PriceLineChart data={data} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Volumen (Barras)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <VolumeBarChart data={data} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Velas Japonesas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <CandlestickChart data={data} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>
      </div>

      {/* Segunda fila */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Área de Precio</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AreaChart data={data} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Precio vs Volumen</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScatterPlot data={data} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribución de Precios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Histogram data={data} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}