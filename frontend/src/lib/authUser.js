/** Reutiliza brevemente el perfil autorizado; los permisos reales siguen validándose en el servidor. */
import { supabase } from "./supabase";

const PROFILE_TTL_MS = 30_000;
let cachedProfile = null;
let expiresAt = 0;
let cachedToken = null;
let pending = null;
let generation = 0;

/** Impide que una petición anterior restaure los permisos de una sesión cerrada. */
export function clearAuthorizedUserCache() {
  generation += 1;
  cachedProfile = null;
  cachedToken = null;
  expiresAt = 0;
  pending = null;
}

/** Permite mostrar un menú ya validado sin repetir el indicador de carga. */
export function getCachedAuthorizedUser() {
  return Date.now() < expiresAt ? cachedProfile : null;
}

/** Comparte solicitudes simultáneas y limita a 30 segundos la reutilización del perfil. */
export async function getAuthorizedUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    clearAuthorizedUserCache();
    return null;
  }
  if (cachedToken !== session.access_token) {
    clearAuthorizedUserCache();
    cachedToken = session.access_token;
  }
  if (Date.now() < expiresAt) return cachedProfile;
  if (pending) return pending;

  const requestGeneration = generation;
  const request = (async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || user.id !== session.user.id) return null;
    // El requisito viene de app_metadata, no de datos editables por el usuario.
    if (user.app_metadata?.must_change_password) {
      return { must_change_password: true };
    }
    const { data, error: profileError } = await supabase
      .from("usuarios_autorizados")
      .select("id, auth_user_id, email, nombre, apellido, rol, activo")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (requestGeneration !== generation) return null;
    if (profileError || !data) return null;
    cachedProfile = data;
    expiresAt = Date.now() + PROFILE_TTL_MS;
    return data;
  })();
  pending = request;
  try {
    return await request;
  } finally {
    if (pending === request) pending = null;
  }
}
