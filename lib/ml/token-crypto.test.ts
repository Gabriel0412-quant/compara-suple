import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  decodeTokenEncryptionKey,
  decryptTokenPair,
  encryptTokenPair,
} from './token-crypto'

const pair = {
  accessToken: 'access-secret-must-not-leak',
  refreshToken: 'refresh-secret-must-not-leak',
}

describe('ML token encryption', () => {
  it('round-trips a token pair with a 256-bit key', () => {
    const key = randomBytes(32)
    const encrypted = encryptTokenPair(pair, key)

    expect(decryptTokenPair(encrypted, key)).toEqual(pair)
    expect(encrypted).not.toContain(pair.accessToken)
    expect(encrypted).not.toContain(pair.refreshToken)
  })

  it('uses a unique nonce for every encryption', () => {
    const key = randomBytes(32)

    expect(encryptTokenPair(pair, key)).not.toBe(encryptTokenPair(pair, key))
  })

  it('fails closed when the authenticated payload is changed', () => {
    const key = randomBytes(32)
    const encrypted = encryptTokenPair(pair, key)
    const envelope = JSON.parse(encrypted) as Record<string, string>
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`

    expect(() => decryptTokenPair(JSON.stringify(envelope), key))
      .toThrowError('ML_TOKEN_DECRYPTION_FAILED')
  })

  it.each(['', 'not-base64', randomBytes(16).toString('base64')])(
    'rejects an invalid encryption key',
    encoded => {
      expect(() => decodeTokenEncryptionKey(encoded))
        .toThrowError('ML_TOKEN_ENCRYPTION_KEY_INVALID')
    },
  )
})

/*
  Cápsula cifrada com a versão v1 do additional data, gravada em 04/09/2026.

  Existe por causa de um achado do rebranding (#119): os testes acima passam
  mesmo trocando `ADDITIONAL_DATA`, porque todos cifram e decifram na mesma
  execução — a mudança é consistente consigo mesma e ninguém percebe. Em
  produção não é assim: o banco tem tokens cifrados com o AAD antigo, e mudar a
  string faz a verificação da tag falhar em todos eles. O OAuth do Mercado Livre
  para de renovar, e o erro só aparece quando o token vence.

  Este teste é o único que reproduz aquela situação: os bytes abaixo foram
  cifrados por uma versão do código, e precisam abrir na versão de hoje.

  Se ele falhar, algo mudou no envelope — AAD, algoritmo ou formato — de um
  jeito que invalida o que já está gravado. A saída não é regravar a fixture: é
  aceitar as duas versões na leitura e migrar os registros antes de remover a
  antiga.
*/
describe('compatibilidade com o que já está cifrado no banco', () => {
  // Chave determinística, e tokens que nunca existiram. Nada aqui é segredo.
  const chaveDaFixture = Buffer.alloc(32, 7)
  const capsulaV1 =
    '{"algorithm":"A256GCM","iv":"NH6CMkU7t0c4dVz2","ciphertext":"TJKXDR4BcbP/Z4GmbKdAjzXpbPNz9LNC+shEEiq9moz1O1EkpgZkFxejVJdjatP73BiWW4KnEqPN/MhCjXb1OPQchstNArBd3jZvyf0=","tag":"RQ5HPPxGFiqqCrjbtn5XqA=="}'

  it('decifra uma cápsula gravada antes do rebranding', () => {
    expect(decryptTokenPair(capsulaV1, chaveDaFixture)).toEqual({
      accessToken: 'access-de-fixture-v1',
      refreshToken: 'refresh-de-fixture-v1',
    })
  })
})
