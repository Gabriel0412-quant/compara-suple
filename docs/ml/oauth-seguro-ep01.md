# OAuth seguro e renovação exclusiva do Mercado Livre

## Objetivo

Permitir que somente um operador autorizado conecte a conta oficial do Mercado Livre, manter os tokens ilegíveis no banco e impedir que duas instâncias consumam o mesmo refresh token.

## Decisões confirmadas

- O início da autorização será um `POST` protegido por `Authorization: Bearer ${ML_ADMIN_SECRET}`.
- A única conta aceita em produção tem `ml_user_id` igual ao valor de `ML_ALLOWED_USER_ID`; o valor atualmente aprovado é `437089518`.
- Access e refresh tokens serão protegidos com AES-256-GCM e uma chave externa `ML_TOKEN_ENCRYPTION_KEY`.
- O banco guardará em claro apenas identificador da conta, expiração, estado operacional, versão da chave, datas e códigos categorizados de erro.
- O `state` OAuth terá 32 bytes aleatórios. Somente seu hash será persistido, com validade de dez minutos e consumo único.
- A renovação usará uma posse temporária adquirida atomicamente no Supabase. Somente o proprietário poderá persistir o novo par.
- O rollout será feito em etapas: migration compatível, deploy, nova autorização, validação, remoção dos tokens legíveis e rotação do `ML_CLIENT_SECRET`.
- Logs e alertas iniciais serão consultados na Vercel, sem payloads externos ou credenciais.

## Fluxo esperado

1. Um operador envia `POST /api/auth/ml/login` com o segredo administrativo.
2. O servidor valida configuração, cria uma tentativa com `state_hash` e devolve a URL do Mercado Livre.
3. O callback consome a tentativa uma única vez, troca o código e valida a conta permitida.
4. O servidor criptografa o par de tokens e deixa a conexão em `connected`.
5. A ingestão lê somente a conexão da conta configurada.
6. Ao aproximar-se da expiração, uma instância adquire a posse de renovação e as demais aguardam o token persistido.
7. `invalid_grant` muda o estado para `reconnect_required`; falhas transitórias liberam a posse.
8. O operador consulta `GET /api/auth/ml/connection` e desconecta com `DELETE /api/auth/ml/connection`, sempre usando `ML_ADMIN_SECRET`.

## Estados operacionais

- `disconnected`: não há credencial utilizável.
- `connected`: existe token válido ou renovável.
- `refreshing`: uma instância possui a renovação por tempo limitado.
- `reconnect_required`: a autorização precisa ser refeita pela conta oficial.

## Limites de segurança

- `ML_ADMIN_SECRET`, tokens, códigos OAuth, `state`, chave de criptografia e payload do provedor nunca aparecem em resposta, log, teste ou documentação.
- `anon` e `authenticated` não leem nem escrevem tentativas ou conexões.
- O callback de outra conta retorna `403` e não altera a conexão vigente.
- O rollback pode desabilitar a integração, mas não pode voltar a ler ou gravar tokens em texto simples.
- As colunas `access_token` e `refresh_token` não existem no schema final.

## Rollout

1. Criar `ML_ADMIN_SECRET`, `ML_ALLOWED_USER_ID` e `ML_TOKEN_ENCRYPTION_KEY` no executor canônico.
2. Aplicar a migration das tentativas, conexão criptografada e funções de posse.
3. Implantar o código e confirmar respostas sanitizadas.
4. Autorizar novamente a conta permitida.
5. Executar coleta e renovação controladas.
6. Aplicar `0009_finalize_ml_oauth_security.sql`, que aborta sem backfill e remove as colunas antigas de token legível.
7. Rotacionar `ML_CLIENT_SECRET` e repetir a autorização final.

## Observabilidade inicial

Os eventos usam `ml_oauth_event` com `event`, `result`, `duration_ms` e um `code` categorizado somente quando necessário. Autorização, renovação, rejeição e desconexão nunca registram credenciais nem payloads externos.

## Relação com outros trabalhos

- O bug #25 comprova coleta e renovação operacional.
- EP03 ampliará alertas, lotes e recuperação da ingestão.
- EP09 fornecerá gates transversais de segurança e CI.
- EP13 migrará o domínio público somente depois que este fluxo estiver protegido.
