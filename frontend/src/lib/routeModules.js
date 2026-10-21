/** Divide el código por menú y permite anticipar su descarga cuando el usuario enfoca un enlace. */
export const routeModules = {
  "/dashboard": () => import("../pages/Dashboard"),
  "/personas": () => import("../pages/Personas"),
  "/asignaciones": () => import("../pages/Asignaciones"),
  "/proyectos": () => import("../pages/Proyectos"),
  "/oportunidades": () => import("../pages/Oportunidades"),
  "/skill-matrix": () => import("../pages/SkillMatrix"),
  "/piramide": () => import("../pages/Piramide"),
  "/usuarios": () => import("../pages/Usuarios"),
  "/skills": () => import("../pages/Skills"),
  "/curriculums": () => import("../pages/Curriculums"),
};

/** La precarga es opcional: un fallo de red no impide que la navegación intente descargar otra vez. */
export function preloadRoute(path) {
  routeModules[path]?.().catch(() => {});
}
