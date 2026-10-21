#!/usr/bin/env python3
"""
Demo de las nuevas herramientas de TalentIA
Simula queries que el agente ahora puede responder
"""
import requests
import json
from datetime import datetime, timedelta

API_BASE_URL = "https://exd-dashboard-eight.vercel.app/api"
API_KEY = "6lMEsiItfbgvbEujEV6f5loSC0tPlU_MGuLOk7QA2ik"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

def demo_proximas_liberaciones():
    """Demo: ¿Quién se libera próximamente?"""
    print("\n" + "="*70)
    print("🔍 QUERY: ¿Quién se libera en los próximos 30 días?")
    print("="*70)
    
    response = requests.get(f"{API_BASE_URL}/asignaciones", headers=headers)
    asignaciones = response.json()
    
    # Filtrar próximas liberaciones
    hoy = datetime.now().date()
    limite = hoy + timedelta(days=30)
    
    liberaciones = []
    for asig in asignaciones:
        if asig.get('fecha_fin'):
            fecha_fin = datetime.fromisoformat(asig['fecha_fin'].replace('Z', '')).date()
            if hoy <= fecha_fin <= limite:
                liberaciones.append({
                    'persona': asig.get('persona_nombre', 'N/A'),
                    'proyecto': asig.get('proyecto_nombre', 'N/A'),
                    'fecha_fin': fecha_fin.strftime('%d/%m/%Y'),
                    'dias_restantes': (fecha_fin - hoy).days
                })
    
    print(f"\n📊 Resultado: {len(liberaciones)} personas se liberan próximamente\n")
    
    liberaciones.sort(key=lambda x: x['dias_restantes'])
    for lib in liberaciones[:5]:  # Top 5
        print(f"   • {lib['persona']:25} - Proyecto: {lib['proyecto']:20}")
        print(f"     └─ Se libera el {lib['fecha_fin']} ({lib['dias_restantes']} días)")
        print()

def demo_proyectos_activos():
    """Demo: ¿Qué proyectos tenemos activos?"""
    print("\n" + "="*70)
    print("🔍 QUERY: ¿Qué proyectos tenemos activos actualmente?")
    print("="*70)
    
    response = requests.get(f"{API_BASE_URL}/proyectos", headers=headers)
    proyectos = response.json()
    
    activos = [p for p in proyectos if p.get('estado') == 'activo']
    
    print(f"\n📊 Resultado: {len(activos)} proyectos activos\n")
    
    for proyecto in activos[:5]:  # Top 5
        nombre = proyecto.get('nombre', 'N/A')
        cliente = proyecto.get('cliente', 'N/A')
        estado = proyecto.get('estado', 'N/A')
        print(f"   • {nombre}")
        print(f"     └─ Cliente: {cliente} | Estado: {estado}")
        print()

def demo_capacidades_equipo():
    """Demo: ¿Qué capacidades tiene el equipo?"""
    print("\n" + "="*70)
    print("🔍 QUERY: Dame un resumen del equipo y sus capacidades")
    print("="*70)
    
    response = requests.get(f"{API_BASE_URL}/personas", headers=headers)
    personas = response.json()
    
    print(f"\n📊 Resultado: {len(personas)} personas en el equipo\n")
    
    # Contar por rol
    roles = {}
    for persona in personas:
        rol = persona.get('rol', 'Sin rol')
        roles[rol] = roles.get(rol, 0) + 1
    
    print("   Distribución por rol:")
    for rol, count in sorted(roles.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"   • {rol:30} - {count:2} personas")

def main():
    print("\n" + "🤖 TalentIA - Demo de Nuevas Capacidades ".center(70, "="))
    print("\nEstas son algunas queries que TalentIA ahora puede responder\n")
    
    try:
        demo_proximas_liberaciones()
        demo_proyectos_activos()
        demo_capacidades_equipo()
        
        print("\n" + "="*70)
        print("\n✨ Conclusión:")
        print("   TalentIA ahora tiene 12 herramientas activas que le permiten")
        print("   responder queries complejas sobre:")
        print("   • Equipo (4 tools)")
        print("   • Asignaciones (2 tools)")
        print("   • Proyectos (2 tools)")
        print("   • Oportunidades (2 tools)")
        print("   • Currículums (2 tools)")
        print("\n   El agente puede combinar información de múltiples fuentes")
        print("   para dar respuestas contextualizadas e inteligentes.")
        print("\n" + "="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main()
