"""
Quién es el usuario según el token de Cognito (claims del authorizer JWT de API Gateway).

Lo usan las dos Lambdas (induplac-api e induplac-config); el deploy copia este
archivo a induplac-config.
"""

# Mismo criterio que el dashboard (dashboard/src/auth/cognito.ts): el grupo dice
# qué puede hacer y custom:sede dice dónde. Si hay varios grupos, gana el primero.
ORDEN_GRUPOS = ["admin-general", "administrador", "admin-sede", "jefe", "operario"]
GRUPOS_TODAS_LAS_SEDES = {"admin-general", "administrador"}
SEDES_COGNITO = {"planta": ["local1"], "oficinas": ["local2"], "todas": ["local1", "local2"]}
PUEDEN_RECONOCER = {"admin-general", "administrador", "admin-sede", "jefe"}
VEN_AUDITORIA = {"admin-general", "administrador", "admin-sede"}
VEN_HISTORICO = {"admin-general", "administrador", "admin-sede", "jefe"}  # el operario solo ve lo actual


def grupos_de(claims):
    g = claims.get("cognito:groups") or []
    if isinstance(g, str):  # API Gateway lo entrega como texto: "[jefe operario]"
        g = g.strip("[]").replace(",", " ").split()
    return list(g)


def perfil(evento):
    """Usuario, grupo y locales del token, o None si no hay sesión válida."""
    claims = (evento.get("requestContext", {}).get("authorizer", {}).get("jwt", {}) or {}).get("claims") or {}
    grupo = next((g for g in ORDEN_GRUPOS if g in grupos_de(claims)), None)
    if not grupo:
        return None
    if grupo in GRUPOS_TODAS_LAS_SEDES:
        locales = ["local1", "local2"]
    else:
        locales = SEDES_COGNITO.get(str(claims.get("custom:sede", "")).strip().lower())
        if not locales:
            return None
    return {"usuario": claims.get("cognito:username") or claims.get("sub", "?"), "grupo": grupo, "locales": locales}


def puede_configurar(quien, local_id):
    """Admins: el general en cualquier sede; el de sede solo en la suya."""
    return bool(quien) and quien["grupo"] in VEN_AUDITORIA and local_id in quien["locales"]
