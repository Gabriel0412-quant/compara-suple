import { ORDENS_DE_MARCA, type OrdemDeMarca } from '@/lib/brands'

/**
 * O "Ordenar por" da maquete 1a.
 *
 * Formulário GET e não menu de JavaScript, pelo mesmo motivo do painel de
 * filtros do #161: a ordem tem que funcionar sem script, e o estado escolhido
 * tem que caber na URL para poder ser compartilhado e voltar no histórico.
 *
 * Tem botão de aplicar, que a maquete não desenha. Sem script não existe
 * "escolher e já valer": ou há um botão, ou a escolha não tem como ser
 * enviada. A maquete desenha o estado final de um menu; aqui o que se entrega
 * é o controle que funciona nos dois casos.
 *
 * `action` aponta para a própria rota, então qualquer outro parâmetro da URL
 * some ao ordenar — hoje `/marcas` não tem nenhum, e quando tiver, ele entra
 * aqui como campo escondido em vez de ser perdido em silêncio.
 */
export function OrdenarMarcas({ ordem }: { ordem: OrdemDeMarca }) {
  return (
    <form action="/marcas" method="get" className="flex flex-wrap items-center gap-2">
      <label htmlFor="ordem" className="font-mono text-sm text-ink-3 sm:text-xs">
        Ordenar por
      </label>
      <select
        id="ordem"
        name="ordem"
        defaultValue={ordem}
        className="min-h-11 rounded-xl border-[1.5px] border-ink bg-surface px-3 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {Object.entries(ORDENS_DE_MARCA).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="min-h-11 rounded-xl border-[1.5px] border-line-strong px-4 text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Aplicar
      </button>
    </form>
  )
}
