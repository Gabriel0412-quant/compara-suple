/**
 * Stub HTTP no lugar do Supabase, para os testes de ponta a ponta.
 *
 * As páginas são server components: consultam o banco no servidor, então
 * `page.route()` do Playwright não alcança essas chamadas — elas não passam
 * pelo navegador. O ponto de controle possível é a URL que `lib/db.ts` lê de
 * `NEXT_PUBLIC_SUPABASE_URL`. Apontando-a para cá, o app roda exatamente como
 * em produção e só a origem dos dados muda; nenhum código de produção precisa
 * saber que está em teste.
 *
 * Não é um PostgREST completo, e não pretende ser: o schema e o SQL de verdade
 * já são exercitados pelo job "Migrações e reconciliação" do CI, contra um
 * Postgres real. O que falta cobrir, e é o que estes testes cobrem, é a
 * navegação e a renderização.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { OFERTAS, PRODUTOS, TOTAIS } from './fixture'

type Linha = Record<string, unknown>

/** `?id=in.(1,2)` → [1,2] */
function parseIn(valor: string | null): number[] | null {
  if (!valor?.startsWith('in.(')) return null
  return valor
    .slice(4, -1)
    .split(',')
    .map(n => Number.parseInt(n, 10))
    .filter(Number.isFinite)
}

/** `?slug=eq.x` → 'x' */
function parseEq(valor: string | null): string | null {
  return valor?.startsWith('eq.') ? valor.slice(3) : null
}

function filtrarProdutos(params: URLSearchParams): Linha[] {
  let linhas: Linha[] = PRODUTOS.map(p => ({
    ...p,
    // O app pede ora `variant`, ora `variants:variant` — devolvemos as duas.
    variants: p.variant,
  }))

  const slug = parseEq(params.get('slug'))
  if (slug) linhas = linhas.filter(p => p.slug === slug)

  const ids = parseIn(params.get('id'))
  if (ids) linhas = linhas.filter(p => ids.includes(p.id as number))

  return linhas
}

function filtrarOfertas(params: URLSearchParams): Linha[] {
  let linhas: Linha[] = [...OFERTAS]

  // A rota /go busca uma oferta por id com `.maybeSingle()`: sem este filtro o
  // stub devolveria o catálogo inteiro e a chamada falharia por trazer mais de
  // uma linha — um erro do stub que pareceria erro da rota.
  const id = parseEq(params.get('id'))
  if (id !== null) linhas = linhas.filter(o => String(o.id) === id)

  const disponivel = parseEq(params.get('available'))
  if (disponivel !== null) {
    linhas = linhas.filter(o => String(o.available) === disponivel)
  }

  const ordem = params.get('order')
  if (ordem?.startsWith('fetched_at.desc')) {
    linhas = [...linhas].sort((a, b) =>
      String(b.fetched_at).localeCompare(String(a.fetched_at)))
  }

  return linhas
}

function responder(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const tabela = url.pathname.replace(/^\/rest\/v1\//, '')
  const params = url.searchParams

  let linhas: Linha[]
  if (tabela === 'product') linhas = filtrarProdutos(params)
  else if (tabela === 'offer') linhas = filtrarOfertas(params)
  else if (tabela === 'brand' || tabela === 'store' || tabela === 'variant') linhas = []
  else {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: `stub: tabela desconhecida "${tabela}"` }))
    return
  }

  const total = linhas.length
  const limite = Number.parseInt(params.get('limit') ?? '', 10)
  if (Number.isFinite(limite)) linhas = linhas.slice(0, limite)

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    // `count: 'exact'` lê o total daqui; é assim que a home conta o catálogo.
    'content-range': `0-${Math.max(total - 1, 0)}/${total}`,
  }

  // `head: true` no supabase-js vira HEAD: só o content-range importa.
  if (req.method === 'HEAD') {
    res.writeHead(200, headers)
    res.end()
    return
  }

  res.writeHead(200, headers)
  res.end(JSON.stringify(linhas))
}

const porta = Number.parseInt(process.env.STUB_PORT ?? '54321', 10)
createServer(responder).listen(porta, () => {
  console.log(`stub supabase em http://127.0.0.1:${porta} · ${TOTAIS.produtos} produtos, ${TOTAIS.ofertas} ofertas`)
})
