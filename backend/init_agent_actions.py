"""Crea solo la tabla de confirmaciones y bloquea su acceso directo desde Supabase cliente."""
from sqlalchemy import text
from database import engine
from services.agent_actions import AgentAction


def main():
    """Instalación idempotente y transaccional; no cambia tablas ni datos de negocio."""
    with engine.begin() as connection:
        AgentAction.__table__.create(bind=connection, checkfirst=True)
        if connection.dialect.name == "postgresql":
            connection.execute(text("ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY"))
            connection.execute(text("REVOKE ALL ON TABLE agent_actions FROM anon, authenticated"))
    print("Tabla de confirmaciones creada/verificada; acceso reservado al backend.")


if __name__ == "__main__":
    main()
