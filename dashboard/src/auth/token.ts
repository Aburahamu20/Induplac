// Token de la sesión actual, para que la fuente de datos lo mande en cada petición
// (Authorization: Bearer <token>, contrato §6).

let token: string | null = null

export const obtenerToken = () => token
export const fijarToken = (t: string | null) => {
  token = t
}
