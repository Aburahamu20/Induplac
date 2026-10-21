// TOTP (RFC 6238), el mismo estándar de Microsoft Authenticator y Cognito.
// Corre en el navegador con Web Crypto: funciona sin internet.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function nuevoSecreto(bytes = 20): string {
  const datos = crypto.getRandomValues(new Uint8Array(bytes))
  let bits = ''
  for (const b of datos) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

function decodificar(secreto: string): Uint8Array<ArrayBuffer> {
  let bits = ''
  for (const c of secreto.replace(/=+$/, '').toUpperCase()) {
    const v = B32.indexOf(c)
    if (v < 0) continue
    bits += v.toString(2).padStart(5, '0')
  }
  const out = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  return out
}

async function codigoEn(secreto: string, contador: number): Promise<string> {
  const clave = await crypto.subtle.importKey('raw', decodificar(secreto), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const msg = new ArrayBuffer(8)
  new DataView(msg).setUint32(4, contador)
  new DataView(msg).setUint32(0, Math.floor(contador / 2 ** 32))
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', clave, msg))
  const o = h[h.length - 1] & 0xf
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, '0')
}

// Acepta el código actual y el de ±30 s (tolerancia de reloj)
export async function verificarCodigo(secreto: string, codigo: string): Promise<boolean> {
  const c = codigo.replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return false
  const ahora = Math.floor(Date.now() / 30_000)
  for (const d of [-1, 0, 1]) if ((await codigoEn(secreto, ahora + d)) === c) return true
  return false
}

export function uriOtpauth(usuario: string, secreto: string, emisor: string): string {
  return `otpauth://totp/${encodeURIComponent(`${emisor}:${usuario}`)}?secret=${secreto}&issuer=${encodeURIComponent(emisor)}&digits=6&period=30`
}
