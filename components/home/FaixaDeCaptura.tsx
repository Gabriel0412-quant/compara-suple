/**
 * A faixa escura de captura da maquete 1b: alerta de preço e guias.
 *
 * ATENÇÃO — o serviço por trás desta faixa não existe.
 *
 * O campo não envia nada e os guias não têm artigo. Ela entrou assim por
 * decisão do dono do produto, registrada no #213, revertendo o que #129 e
 * #130 tinham decidido. O motivo original de elas estarem bloqueadas continua
 * valendo e vale reler antes de mexer aqui: um campo de e-mail que não envia
 * e-mail promete serviço inexistente e coleta dado pessoal sem finalidade, e
 * este é o primeiro dado pessoal identificável que o produto pediria — depois
 * de o #17 ter decidido não medir pessoas.
 *
 * O que este arquivo faz é conter o estrago dentro da decisão tomada:
 *
 * 1. **Não existe `<form>`.** Um `<form>` sem `action` faz GET para a própria
 *    URL ao pressionar Enter, e o e-mail digitado iria parar na barra de
 *    endereço, no histórico do navegador e nos logs da Vercel. Sem `<form>`,
 *    o que a pessoa digita não sai do campo.
 * 2. **O botão não finge sucesso.** Nada de "obrigado" nem "cadastrado": ele
 *    não faz nada, e é isso que `e2e/home.spec.ts` trava.
 * 3. **Os guias são texto, não link.** Os três artigos não existem; link para
 *    eles seria 404 na home.
 *
 * Quando o EP18 (#97–#101) entregar assinante, consentimento, double opt-in e
 * descadastro, o campo passa a enviar e estes três limites saem junto.
 */

const GUIAS = [
  'Concentrado, isolado ou hidrolisado: qual vale o preço',
  'Como calcular o preço por grama de proteína',
  'Creatina: onde está a economia por tamanho',
] as const

export function FaixaDeCaptura() {
  return (
    <section
      aria-labelledby="faixa-de-captura"
      className="px-4 pb-0 pt-8 md:px-10"
    >
      <h2 id="faixa-de-captura" className="sr-only">
        Alerta de preço e guias
      </h2>

      <div className="mx-auto grid max-w-7xl gap-10 rounded-t-3xl bg-surface-dark px-8 py-12 text-ink-on-dark md:grid-cols-2 md:gap-0 md:px-12">
        <div className="md:pr-12">
          <h3 className="text-2xl font-bold tracking-[-0.02em]">Alerta de preço por e-mail</h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-on-dark-3">
            Diz o preço que você aceita pagar e a gente avisa no dia em que a oferta aparecer. Sem
            cadastro.
          </p>

          {/*
            Sem `<form>`, de propósito — ver o cabeçalho do arquivo. O `div`
            existe só para alinhar campo e botão.
          */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="alerta-email" className="sr-only">
              Seu e-mail
            </label>
            <input
              id="alerta-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className="min-h-11 flex-1 rounded-xl border border-line-dark bg-surface-dark-raised px-4 text-sm text-ink-on-dark placeholder:text-ink-on-dark-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
            {/*
              `type="button"` e sem `onClick`: não navega, não recarrega e não
              anuncia sucesso nenhum.
            */}
            <button
              type="button"
              className="min-h-11 rounded-xl bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Quero ser avisado
            </button>
          </div>
        </div>

        <div className="md:border-l md:border-line-dark md:pl-12">
          <h3 className="text-2xl font-bold tracking-[-0.02em]">Guias</h3>
          {/*
            Texto, não link: os três artigos são o #130 e ainda não existem.
            Como link, cada um seria um 404 saindo da home.
          */}
          <ul className="mt-5 space-y-4">
            {GUIAS.map(guia => (
              <li key={guia} className="text-sm font-medium leading-relaxed text-ink-on-dark-2">
                {guia}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
