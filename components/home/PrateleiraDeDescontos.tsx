import { Prateleira } from '@/components/home/Prateleira'
import type { CategoryProduct } from '@/lib/categories'

/**
 * Os maiores descontos, na mesma prateleira das categorias.
 *
 * Era um grid de seis cards próprios, com selo "DESCONTO", ícone de seta para
 * baixo e um card diferente do resto da home. Virou prateleira no #211, e o
 * card passou a ser o mesmo `ProductGridCard` das outras — que é o que "igual
 * ao bloco de Whey Protein" quer dizer.
 *
 * O nome continua sendo "Maiores descontos", e isso importa. Ele já se chamou
 * "Em queda agora", com selo pulsando: aquilo afirmava variação de preço no
 * tempo, e o dado por trás é `original_price` do próprio anúncio — desconto em
 * relação ao preço anunciado, não queda observada entre coletas. O teste em
 * `e2e/prateleiras.spec.ts` continua proibindo o nome antigo de voltar.
 *
 * A legenda é o que sustenta o título, então ela veio junto.
 */
export function PrateleiraDeDescontos({ produtos }: { produtos: CategoryProduct[] }) {
  /*
    Sem desconto, a seção some — não vira caixa com promessa.

    O estado vazio dizia "quando rolar desconto, aparece aqui", que é promessa
    de conteúdo futuro: a mesma coisa que `FaixaDeMarcas` recusa quando não há
    marca, e que `e2e/home.spec.ts` trava para as seções ausentes. Se não há
    desconto na última coleta, a home simplesmente começa pelas categorias.
  */
  if (produtos.length === 0) return null

  return (
    <Prateleira
      id="prateleira-maiores-descontos"
      titulo="Maiores descontos"
      legenda="Produtos com maior desconto em relação ao preço anunciado no Mercado Livre, na última coleta."
      link={{ href: '/ofertas', rotulo: 'Ver todas as ofertas' }}
      produtos={produtos}
    />
  )
}
