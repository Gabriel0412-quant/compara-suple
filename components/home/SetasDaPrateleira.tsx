'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Setas de navegação da prateleira.
 *
 * É ilha client de propósito, e só aparece depois de medir que há transbordo:
 * sem JavaScript as setas não existem, em vez de existirem e não fazer nada.
 * Botão inerte é o que o header antigo tinha com "Entrar", e o projeto já
 * decidiu que controle sem ação sai da tela.
 *
 * O conteúdo não depende delas. A faixa é um container com `overflow-x-auto` e
 * `scroll-snap`, então rolagem por toque, trackpad, barra e teclado continuam
 * funcionando com ou sem script.
 */

type Props = {
  /** `id` do container rolável. Buscado no DOM porque ele é server component. */
  alvo: string
  rotulo: string
}

/** Folga em px para não tratar arredondamento de subpixel como "tem mais". */
const FOLGA = 4

export function SetasDaPrateleira({ alvo, rotulo }: Props) {
  /*
    Começa `false`, e é isso que faz as setas não existirem no HTML servido: o
    servidor renderiza `null`, e só depois de medir no navegador elas aparecem.
  */
  const [temOverflow, setTemOverflow] = useState(false)
  const [podeVoltar, setPodeVoltar] = useState(false)
  const [podeAvancar, setPodeAvancar] = useState(false)

  const medir = useCallback((el: HTMLElement) => {
    const sobra = el.scrollWidth - el.clientWidth
    setTemOverflow(sobra > FOLGA)
    setPodeVoltar(el.scrollLeft > FOLGA)
    setPodeAvancar(el.scrollLeft < sobra - FOLGA)
  }, [])

  useEffect(() => {
    const el = document.getElementById(alvo)
    if (!el) return

    /*
      A medição fica dentro dos observadores, que já disparam uma vez ao
      observar. Medir também de forma síncrona aqui dispararia `setState`
      durante o efeito, o que o lint acusa como render em cascata.
    */
    const aoRolar = () => medir(el)
    const observer = new ResizeObserver(aoRolar)
    observer.observe(el)
    el.addEventListener('scroll', aoRolar, { passive: true })

    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', aoRolar)
    }
  }, [alvo, medir])

  // Setas que não têm para onde rolar não aparecem: com os cards cabendo na
  // largura, seriam decoração que não faz nada.
  if (!temOverflow) return null

  const rolar = (direcao: 1 | -1) => {
    const el = document.getElementById(alvo)
    if (!el) return
    /*
      Rola por página, não por card: um card de cada vez em desktop, onde
      cabem quatro, dá a sensação de que a seta está travada. Mede a largura
      visível e desconta um card, para o último da tela reaparecer na borda e
      não perder o contexto.
    */
    const card = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0
    const passo = Math.max(card, el.clientWidth - card)
    el.scrollBy({ left: direcao * passo, behavior: 'smooth' })
  }

  const base =
    'flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
  /*
    Desabilitada na ponta, como no site que serviu de referência: seta que
    parece clicável e não move nada é a mesma falha do controle sem ação, em
    escala menor. `disabled` também tira do alcance do teclado.
  */
  const ativa = 'border-ink bg-surface text-ink hover:bg-surface-muted'
  const inerte = 'cursor-not-allowed border-line bg-surface text-ink-4'

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => rolar(-1)}
        disabled={!podeVoltar}
        aria-label={`Ver anteriores em ${rotulo}`}
        className={`${base} ${podeVoltar ? ativa : inerte}`}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        onClick={() => rolar(1)}
        disabled={!podeAvancar}
        aria-label={`Ver próximos em ${rotulo}`}
        className={`${base} ${podeAvancar ? ativa : inerte}`}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}
