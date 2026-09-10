import { Prateleira } from '@/components/home/Prateleira'
import { formatCount } from '@/lib/stats'
import type { Prateleira as DadosDaPrateleira } from '@/lib/shelves'

/**
 * Um bloco por categoria na home, conforme a maquete 1b.
 *
 * Os cards são o `ProductGridCard` de sempre, sem variante nova. Ele já
 * carrega decisões que custaram caro e que não podem divergir por superfície:
 * preço por dose ou por quilo com "sem dose ou peso informado" quando não há
 * nenhum dos dois; selo de desconto só quando `original_price` sustenta;
 * linha de menor preço só quando ela contradiz o destaque; e nada de botão
 * apontando para lugar nenhum quando falta oferta.
 *
 * A rolagem, as setas e a largura dos cards moram em `Prateleira`, que este
 * componente e o dos descontos compartilham desde o #211.
 */
export function PrateleiraDeCategoria({ prateleira }: { prateleira: DadosDaPrateleira }) {
  const { categoria, produtos, totalProdutos, totalOfertas } = prateleira

  return (
    <Prateleira
      id={`prateleira-${categoria.slug}`}
      titulo={categoria.name}
      /*
        Os totais são da categoria inteira, não dos exibidos — é o que o read
        model separa em `totalProdutos` e `totalOfertas`. Dizer "4 produtos"
        quando a categoria tem nove seria contar a vitrine.
      */
      meta={
        <>
          {formatCount(totalProdutos)} {totalProdutos === 1 ? 'produto' : 'produtos'} ·{' '}
          {formatCount(totalOfertas)} {totalOfertas === 1 ? 'oferta' : 'ofertas'}
        </>
      }
      link={{ href: `/categoria/${categoria.slug}`, rotulo: 'Ver todos' }}
      produtos={produtos}
    />
  )
}
