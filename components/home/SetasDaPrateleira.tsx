'use client'

import { useEffect, useState } from 'react'

/**
 * Setas de navegação da prateleira.
 *
 * É ilha client de propósito, e só aparece depois de montar: sem JavaScript
 * as setas simplesmente não existem, em vez de existirem e não fazer nada.
 * Botão inerte é o que o header antigo tinha com "Entrar", e o projeto já
 * decidiu que controle sem ação sai da tela.
 *
 * O conteúdo não depende delas. A faixa é um container com `overflow-x-auto`
 * e `scroll-snap`, então rolagem por toque, trackpad, barra e teclado
 * continuam funcionando com ou sem script.
 */

type Props = {
  /** `id` do container rolável. Buscado no DOM porque ele é server component. */
  alvo: string
  rotulo: string
}

export function SetasDaPrateleira({ alvo, rotulo }: Props) {
  /*
    Começa `false`, e é isso que faz as setas não existirem no HTML servido:
    o servidor renderiza `null`, e só depois de medir no navegador elas
    aparecem. Sem JavaScript, nunca aparecem — que é o comportamento certo
    para um controle que depende de script para funcionar.
  */
  const [temOverflow, setTemOverflow] = useState(false)

  useEffect(() => {
    const el = document.getElementById(alvo)
    if (!el) return

    /*
      A medição fica só dentro do ResizeObserver, que já dispara uma vez ao
      observar. Medir também de forma síncrona aqui dispararia `setState`
      durante o efeito, o que o lint acusa como render em cascata — e a
      chamada síncrona seria redundante de qualquer jeito.

      Setas que não têm para onde rolar não devem aparecer: com quatro cards
      cabendo na largura, seriam decoração que não faz nada.
    */
    const observer = new ResizeObserver(() =>
      setTemOverflow(el.scrollWidth > el.clientWidth + 4),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [alvo])

  if (!temOverflow) return null

  const rolar = (direcao: 1 | -1) => {
    const el = document.getElementById(alvo)
    if (!el) return
    // Um card por clique: a largura do primeiro filho, com o gap.
    const passo = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth
    el.scrollBy({ left: direcao * (passo + 14), behavior: 'smooth' })
  }

  const classe =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-3 transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => rolar(-1)} aria-label={`Ver anteriores em ${rotulo}`} className={classe}>
        <span aria-hidden="true">‹</span>
      </button>
      <button type="button" onClick={() => rolar(1)} aria-label={`Ver próximos em ${rotulo}`} className={classe}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}
