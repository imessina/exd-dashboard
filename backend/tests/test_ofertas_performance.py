"""Verifica el contrato del catálogo y que su número de consultas no crezca con las ofertas."""
import os
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

with patch.dict(os.environ, {"DEBUG": "false", "DATABASE_URL": "sqlite://"}):
    import models
    from routes.ofertas_valor import listar_ofertas_valor, _serialize


class OfertasPerformanceTests(unittest.TestCase):
    def setUp(self):
        """Usa tablas SQLite aisladas; nunca consulta datos reales."""
        self.engine = create_engine("sqlite://")
        models.Persona.__table__.create(self.engine)
        models.OfertaValor.__table__.create(self.engine)
        self.db = Session(self.engine)
        self.db.add(models.Persona(id="owner", nombre="Responsable", rol="Lead", oferta_valor="Oferta 0"))
        self.db.add_all([
            models.OfertaValor(id=str(index), nombre=f"Oferta {index}", responsable_persona_id="owner", activa=index != 6)
            for index in range(7)
        ])
        self.db.commit()
        self.statements = []
        event.listen(self.engine, "before_cursor_execute", self.record_query)

    def record_query(self, connection, cursor, statement, parameters, context, executemany):
        self.statements.append(statement)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_list_uses_three_queries_and_preserves_response(self):
        result = listar_ofertas_valor(solo_activas=False, db=self.db)
        self.assertEqual(len(self.statements), 3)
        expected = [_serialize(self.db, oferta) for oferta in self.db.query(models.OfertaValor).order_by(models.OfertaValor.nombre).all()]
        self.assertEqual(result, expected)

    def test_active_filter_and_zero_counts(self):
        result = listar_ofertas_valor(solo_activas=True, db=self.db)
        self.assertEqual(len(result), 6)
        self.assertEqual(result[0]["personas_count"], 1)
        self.assertEqual(result[1]["personas_count"], 0)
        self.assertTrue(all(oferta["activa"] for oferta in result))

    def test_empty_catalog_uses_one_query(self):
        self.db.query(models.OfertaValor).delete()
        self.db.commit()
        self.statements.clear()
        self.assertEqual(listar_ofertas_valor(solo_activas=False, db=self.db), [])
        self.assertEqual(len(self.statements), 1)
