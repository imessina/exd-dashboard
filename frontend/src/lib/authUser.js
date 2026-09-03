import { supabase } from "./supabase";

export async function getAuthorizedUser() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("AUTH USER:", user);
  console.log("AUTH ERROR:", userError);

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("usuarios_autorizados")
    .select(`
      id,
      auth_user_id,
      email,
      nombre,
      apellido,
      rol,
      activo
    `)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  console.log("USUARIO AUTORIZADO:", data);
  console.log("ERROR USUARIO AUTORIZADO:", error);

  if (error || !data) {
    return null;
  }

  return data;
}