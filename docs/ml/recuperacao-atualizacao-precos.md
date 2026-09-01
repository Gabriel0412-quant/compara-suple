# Recuperação da atualização de preços do Mercado Livre

## Objetivo

Restaurar a ingestão quando os preços estiverem antigos, a autorização estiver vencida ou o cron não estiver executando trabalho real. Este procedimento não substitui a evolução estrutural de OAuth e orquestração descrita em EP01 e EP03.

## Topologia de produção

O projeto Vercel ligado a `Gabriel0412-quant/compara-suple` é o único executor da ingestão. Seu domínio operacional é `compara-suple-sable.vercel.app`.

O projeto ligado a `matheus050/compara-suple` serve o site espelhado, mas não deve possuir cron ativo nem `CRON_SECRET`. Dois executores podem disputar a mesma ingestão e o refresh token de uso único.

## Configuração obrigatória do executor

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Projeto que armazena catálogo, ofertas e tokens. |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrita server-side e leitura do token protegido. |
| `ML_APP_ID` | Identidade da aplicação no Mercado Livre. |
| `ML_CLIENT_SECRET` | Troca e renovação dos tokens. |
| `ML_REDIRECT_URI` | Callback exato cadastrado no DevCenter. |
| `ML_ADMIN_SECRET` | Protege o início da autorização administrativa. |
| `ML_ALLOWED_USER_ID` | Identifica a única conta aceita. |
| `ML_TOKEN_ENCRYPTION_KEY` | Criptografa o par de tokens no servidor. |
| `ML_TOKEN_ENCRYPTION_KEY_VERSION` | Versiona a chave usada pelo payload. |
| `CRON_SECRET` | Autoriza o cron e a execução manual. |

O redirect de produção é `https://compara-suple-sable.vercel.app/api/auth/ml/callback`. O DevCenter deve habilitar `offline_access` para devolver um refresh token.

Valores nunca devem ser copiados para issue, PR, resposta HTTP ou log. A validação registra somente os nomes das variáveis ausentes.

## Contratos HTTP

- `GET /api/health` é o healthcheck público e não consulta integrações.
- `GET /api/cron/ml-ingest` é chamado pelo Vercel Cron e exige `Authorization: Bearer ${CRON_SECRET}`.
- `POST /api/cron/ml-ingest` permite recuperação manual com a mesma autenticação.
- `GET /api/auth/ml/connection` devolve somente estado, expiração e códigos operacionais usando `ML_ADMIN_SECRET`.
- `DELETE /api/auth/ml/connection` apaga atomicamente o payload criptografado usando `ML_ADMIN_SECRET`.
- Ausência de configuração retorna `503 configuration_error`.
- Ausência ou divergência de autorização retorna `401 unauthorized`.
- Token ausente, expirado sem refresh ou resposta OAuth incompleta retorna `503 auth_required`.
- Uma execução em que todos os catálogos falham retorna `500 ingestion_failed`; nunca `200` com zero trabalho.

## Procedimento de recuperação

1. Confirmar no DevCenter que a aplicação oficial possui `offline_access` e o redirect exato do executor.
2. Conferir a presença das variáveis obrigatórias no ambiente Production do executor, sem imprimir valores.
3. Solicitar uma URL de autorização usando o segredo lido diretamente do gerenciador de segredos:

   ```bash
   curl --fail-with-body \
     --request POST \
     --header "Authorization: Bearer ${ML_ADMIN_SECRET}" \
     https://compara-suple-sable.vercel.app/api/auth/ml/login
   ```

4. Abrir o `authorization_url` retornado em uma sessão autenticada na conta oficial do Mercado Livre.
5. Autorizar a aplicação e confirmar que o callback informa sucesso, usuário esperado e expiração futura. A resposta não deve conter tokens.
6. Disparar a coleta manual com o segredo lido diretamente do gerenciador de segredos:

   ```bash
   curl --fail-with-body \
     --request POST \
     --header "Authorization: Bearer ${CRON_SECRET}" \
     https://compara-suple-sable.vercel.app/api/cron/ml-ingest
   ```

7. Confirmar que `catalogs_ingested` e `offers_ingested` são maiores que zero ou que cada catálogo possui falha explícita.
8. Consultar somente metadados no Supabase: maior `offer.fetched_at`, observações de `price_history` no dia e expiração futura do token.
9. Abrir a home pública e confirmar `hoje` em “última coleta de preços”.
10. Conferir pelo menos três produtos contra as respostas atuais do Mercado Livre.
11. Depois que o primeiro access token vencer, repetir a coleta sem novo login e confirmar atualização da expiração. Isso prova a rotação do refresh token.
12. Observar a próxima execução das 09:00 UTC e registrar apenas horário, duração, totais e código de resultado.

## Limite de catálogo curado

`data/items.json` contém somente IDs de Catalog Product no formato `MLB` numérico. IDs `MLBU` são User Products vinculados a um vendedor e usam `/user-products`, com regras de acesso e descoberta de anúncios diferentes. Eles não podem ser enviados silenciosamente ao endpoint `/products`; precisam de um fluxo próprio antes de entrarem na lista diária.

## Diagnóstico por código

| Código | Significado | Ação |
|---|---|---|
| `unauthorized` | Cabeçalho não corresponde ao `CRON_SECRET`. | Corrigir o segredo do executor e confirmar que o espelho não o possui. |
| `configuration_error` | Variável obrigatória ausente. | Consultar o log sanitizado e configurar somente o nome indicado. |
| `auth_required` | Autorização ausente, inválida ou sem refresh token. | Refazer o fluxo com a conta oficial. |
| `ingestion_failed` | Falha não classificada na coleta. | Consultar o log por horário e catálogo sem copiar payload externo. |

## Validação de segurança

- Uma chamada sem segredo deve retornar `401` e não executar trabalho.
- Resposta OAuth sem refresh token não pode substituir a conexão existente.
- Erros HTTP e logs não devem incluir access token, refresh token, client secret, service role ou `CRON_SECRET`.
- O projeto espelho não pode iniciar ingestão.

## Rollback

1. Remover ou desabilitar o cron no executor.
2. Reverter a mudança de aplicação sem apagar ofertas ou histórico.
3. Preservar o último token válido; não restaurar um refresh token que já tenha sido usado.
4. Manter a home informando a data real da última coleta.

## Referências

- [Issue #25](https://github.com/Gabriel0412-quant/compara-suple/issues/25)
- [EP01 — OAuth do Mercado Livre](https://github.com/users/Gabriel0412-quant/projects/1)
- [EP03 — operação das ingestões](https://github.com/users/Gabriel0412-quant/projects/1)
- [Mercado Livre — autenticação e refresh token](https://developers.mercadolivre.com.br/autenticacao-e-autorizacao)
