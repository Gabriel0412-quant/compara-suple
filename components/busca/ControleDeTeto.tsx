'use client'

import { useState } from 'react'

/**
 * Um teto arrastável, com o valor escrito ao lado.
 *
 * É o slider da maquete. Só ele é cliente, e por um motivo estreito: sem
 * JavaScript o `<input type="range">` continua arrastando e continua enviando
 * pelo botão "Aplicar" do formulário — o que não funciona é o rótulo
 * acompanhar o arraste. Este componente existe só para esse rótulo.
 *
 * Por isso o valor inicial vem do servidor e o `name` é o mesmo: com script ou
 * sem, o que o formulário envia é idêntico. `e2e/busca.spec.ts` roda o caso com
 * `javaScriptEnabled: false` para cobrar isso.
 */
/** Reais inteiros para preço; centavos para R$/dose, que vive abaixo de R$ 10. */
function escrever(valor: number, formato: 'reais' | 'dose'): string {
  return formato === 'dose'
    ? `R$ ${valor.toFixed(2).replace('.', ',')}`
    : `R$ ${Math.round(valor)}`
}

export function ControleDeTeto({
  id,
  name,
  rotulo,
  min,
  max,
  step,
  inicial,
  formato,
}: {
  id: string
  name: string
  rotulo: string
  min: number
  max: number
  step: number
  inicial: number | null
  /**
   * Como escrever o valor. É um rótulo, e não uma função, porque função não
   * atravessa a fronteira servidor→cliente: passá-la daqui derruba a página
   * com "Functions cannot be passed directly to Client Components".
   */
  formato: 'reais' | 'dose'
}) {
  const [valor, setValor] = useState(inicial ?? max)
  const noTeto = valor >= max

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs text-ink-3">
          {rotulo}
        </label>
        {/*
          No máximo, o rótulo diz "sem limite" em vez do número.

          Um slider encostado na direita mostrando "R$ 290" parece um teto
          escolhido, quando na verdade é a ausência de teto — e a diferença
          importa: com teto no máximo, produto sem dose informada continua
          aparecendo.
        */}
        <span className="font-mono text-xs font-semibold text-ink">
          {noTeto ? 'sem limite' : escrever(valor, formato)}
        </span>
      </div>
      <input
        id={id}
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={valor}
        onChange={e => setValor(Number(e.target.value))}
        className="w-full accent-brand"
      />
      {/*
        No máximo, o campo não deve ir para a URL: `preco_max` igual ao teto do
        catálogo filtraria nada e ainda assim viraria chip. `disabled` mantém o
        controle visível e arrastável e o tira do envio.
      */}
      {noTeto && <input type="hidden" name={name} value="" disabled />}
    </div>
  )
}
