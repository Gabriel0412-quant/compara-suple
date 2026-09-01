# EP01 — Proteger e estabilizar o OAuth do Mercado Livre

## O que será feito

Substituir o OAuth público e o armazenamento legível por uma conexão restrita à conta oficial, protegida por criptografia, tentativas consumíveis e renovação com exclusão mútua no banco.

## Abordagem técnica

- `POST` administrativo com `ML_ADMIN_SECRET`.
- `ML_ALLOWED_USER_ID` para negar outra conta antes da persistência.
- AES-256-GCM com `ML_TOKEN_ENCRYPTION_KEY` e versão de chave.
- Tentativas OAuth persistidas somente como SHA-256 do `state`.
- Conexão buscada pela conta configurada, nunca pelo registro mais recente.
- Posse atômica e temporária para uma única renovação.
- Estados `disconnected`, `connected`, `refreshing` e `reconnect_required`.
- Rollout em duas migrations para não reintroduzir texto simples no rollback.

## Testes

- Segredo administrativo ausente ou inválido.
- Tentativa válida, expirada e reutilizada.
- Conta permitida e conta rejeitada.
- Criptografia com nonce único, autenticação e chave inválida.
- Resposta OAuth incompleta.
- Vinte renovações concorrentes com uma chamada externa.
- Posse expirada e `invalid_grant`.
- Negação de leitura e escrita pública no Supabase.
- Sanitização de logs e respostas.

## Riscos

- Migration incorreta pode interromper a ingestão.
- Rotação concorrente pode invalidar o refresh token vigente.
- Troca de chave sem versionamento pode tornar o payload ilegível.
- Rollback não pode depender das colunas antigas depois que forem apagadas.

## Decisões aprovadas

- Conta oficial configurada: `437089518`.
- Canal operacional inicial: logs e alertas da Vercel.
- Rotacionar tokens e `ML_CLIENT_SECRET` após o rollout.
