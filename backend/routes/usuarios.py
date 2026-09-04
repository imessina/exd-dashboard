import json
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from auth import (
    require_admin_or_higher,
    require_superadmin,
)
from config import settings
from database import get_db


router = APIRouter(
    prefix="/usuarios",
    tags=["usuarios"],
)

logger = logging.getLogger("uvicorn.error")


# ============================================================
# MODELOS
# ============================================================


class UsuarioCreate(BaseModel):
    email: EmailStr
    nombre: str
    apellido: str
    rol: Literal[
        "superadmin",
        "admin",
        "editor",
        "viewer",
    ]


class UsuarioEstadoUpdate(BaseModel):
    activo: bool


class UsuarioUpdate(BaseModel):
    nombre: str
    apellido: str
    email: EmailStr
    rol: Literal[
        "superadmin",
        "admin",
        "editor",
        "viewer",
    ]
    activo: bool


# ============================================================
# CREAR USUARIO
# SOLO SUPERADMIN
# ============================================================


@router.post("/", status_code=201)
def crear_usuario(
    data: UsuarioCreate,
    superadmin: dict = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    email = str(data.email).strip().lower()
    nombre = data.nombre.strip()
    apellido = data.apellido.strip()

    if not nombre:
        raise HTTPException(
            status_code=400,
            detail="El nombre es obligatorio",
        )

    if not apellido:
        raise HTTPException(
            status_code=400,
            detail="El apellido es obligatorio",
        )

    existente = db.execute(
        text(
            """
            SELECT id
            FROM public.usuarios_autorizados
            WHERE lower(email) = :email
            LIMIT 1
            """
        ),
        {
            "email": email,
        },
    ).first()

    if existente:
        raise HTTPException(
            status_code=409,
            detail="El usuario ya está registrado",
        )

    if (
        not settings.SUPABASE_URL
        or not settings.SUPABASE_SECRET_KEY
    ):
        raise HTTPException(
            status_code=503,
            detail="Supabase Auth no está configurado",
        )

    payload = json.dumps(
        {
            "email": email,
            "redirect_to": (
                "http://localhost:5173/establecer-password"
                "establecer-password"
            ),
            "data": {
                "nombre": nombre,
                "apellido": apellido,
            },
        }
    ).encode("utf-8")

    request = Request(
        (
            f"{settings.SUPABASE_URL.rstrip('/')}"
            "/auth/v1/invite"
        ),
        data=payload,
        method="POST",
        headers={
            "Authorization": (
                f"Bearer {settings.SUPABASE_SECRET_KEY}"
            ),
            "apikey": settings.SUPABASE_SECRET_KEY,
            "Content-Type": "application/json",
        },
    )

    try:
        with urlopen(
            request,
            timeout=15,
        ) as response:
            body = response.read().decode("utf-8")
            auth_user = json.loads(body)

    except HTTPError as exc:
        try:
            error_body = json.loads(
                exc.read().decode("utf-8")
            )

            message = (
                error_body.get("msg")
                or error_body.get("message")
                or "No fue posible invitar al usuario"
            )

        except Exception:
            message = (
                "No fue posible invitar al usuario"
            )

        logger.warning(
            "Supabase rechazó invitación para %s: %s",
            email,
            message,
        )

        raise HTTPException(
            status_code=400,
            detail=message,
        )

    except (URLError, TimeoutError):
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible contactar "
                "a Supabase Auth"
            ),
        )

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Respuesta inválida de Supabase Auth"
            ),
        )

    auth_user_id = auth_user.get("id")

    if not auth_user_id:
        raise HTTPException(
            status_code=502,
            detail=(
                "Supabase no devolvió "
                "el identificador del usuario"
            ),
        )

    try:
        result = db.execute(
            text(
                """
                INSERT INTO public.usuarios_autorizados (
                    auth_user_id,
                    email,
                    nombre,
                    apellido,
                    rol,
                    activo
                )
                VALUES (
                    :auth_user_id,
                    :email,
                    :nombre,
                    :apellido,
                    :rol,
                    true
                )
                RETURNING
                    id,
                    auth_user_id,
                    email,
                    nombre,
                    apellido,
                    rol,
                    activo,
                    created_at
                """
            ),
            {
                "auth_user_id": auth_user_id,
                "email": email,
                "nombre": nombre,
                "apellido": apellido,
                "rol": data.rol,
            },
        ).mappings().first()

        db.commit()

    except Exception:
        db.rollback()

        logger.exception(
            "Error guardando usuario autorizado %s",
            email,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "La invitación fue creada, "
                "pero ocurrió un error guardando "
                "los permisos del usuario"
            ),
        )

    return {
        "status": "success",
        "usuario": dict(result),
    }


# ============================================================
# EDITAR USUARIO COMPLETO
# SUPERADMIN Y ADMIN
# ============================================================


@router.patch("/{usuario_id}")
def actualizar_usuario(
    usuario_id: str,
    payload: UsuarioUpdate,
    usuario_actual: dict = Depends(
        require_admin_or_higher
    ),
    db: Session = Depends(get_db),
):
    usuario = db.execute(
        text(
            """
            SELECT
                id,
                auth_user_id,
                email,
                nombre,
                apellido,
                rol,
                activo
            FROM public.usuarios_autorizados
            WHERE id = :usuario_id
            LIMIT 1
            """
        ),
        {
            "usuario_id": usuario_id,
        },
    ).mappings().first()

    if not usuario:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado",
        )

    # --------------------------------------------------------
    # REGLAS PARA ADMIN
    # --------------------------------------------------------

    if usuario_actual["rol"] == "admin":
        # Un admin no puede modificar superadmins
        if usuario["rol"] == "superadmin":
            raise HTTPException(
                status_code=403,
                detail=(
                    "Un administrador no puede "
                    "editar a un superadministrador"
                ),
            )

        # Un admin no puede asignar superadmin
        if payload.rol == "superadmin":
            raise HTTPException(
                status_code=403,
                detail=(
                    "Un administrador no puede "
                    "asignar el rol de "
                    "superadministrador"
                ),
            )

    nombre = payload.nombre.strip()
    apellido = payload.apellido.strip()
    email = str(payload.email).strip().lower()

    if not nombre or not apellido:
        raise HTTPException(
            status_code=400,
            detail=(
                "Nombre y apellido son obligatorios"
            ),
        )

    existente = db.execute(
        text(
            """
            SELECT id
            FROM public.usuarios_autorizados
            WHERE lower(email) = :email
              AND id <> :usuario_id
            LIMIT 1
            """
        ),
        {
            "email": email,
            "usuario_id": usuario_id,
        },
    ).first()

    if existente:
        raise HTTPException(
            status_code=409,
            detail="El correo ya está registrado",
        )

    es_usuario_actual = (
        usuario["auth_user_id"]
        == usuario_actual["auth_user_id"]
    )

    # Nadie puede desactivarse a sí mismo
    if es_usuario_actual and not payload.activo:
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes desactivar "
                "tu propia cuenta"
            ),
        )

    # Un superadmin no puede quitarse
    # a sí mismo su rol de superadmin
    if (
        es_usuario_actual
        and usuario_actual["rol"] == "superadmin"
        and payload.rol != "superadmin"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes quitarte el rol "
                "de superadministrador"
            ),
        )

    if (
        not settings.SUPABASE_URL
        or not settings.SUPABASE_SECRET_KEY
    ):
        raise HTTPException(
            status_code=503,
            detail="Supabase no está configurado",
        )

    # --------------------------------------------------------
    # ACTUALIZAR SUPABASE AUTH
    # --------------------------------------------------------

    auth_payload = json.dumps(
        {
            "email": email,
            "user_metadata": {
                "nombre": nombre,
                "apellido": apellido,
            },
        }
    ).encode("utf-8")

    request = Request(
        (
            f"{settings.SUPABASE_URL.rstrip('/')}"
            f"/auth/v1/admin/users/"
            f"{usuario['auth_user_id']}"
        ),
        data=auth_payload,
        method="PUT",
        headers={
            "Authorization": (
                f"Bearer "
                f"{settings.SUPABASE_SECRET_KEY}"
            ),
            "apikey": settings.SUPABASE_SECRET_KEY,
            "Content-Type": "application/json",
        },
    )

    try:
        with urlopen(
            request,
            timeout=10,
        ) as response:
            response.read()

    except HTTPError as exc:
        body = exc.read().decode(
            "utf-8",
            errors="ignore",
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "No fue posible actualizar "
                "el usuario en Supabase Auth: "
                f"{body}"
            ),
        )

    except (URLError, TimeoutError):
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible conectar "
                "con Supabase Auth"
            ),
        )

    # --------------------------------------------------------
    # ACTUALIZAR TABLA AUTORIZADOS
    # --------------------------------------------------------

    try:
        result = db.execute(
            text(
                """
                UPDATE public.usuarios_autorizados
                SET
                    email = :email,
                    nombre = :nombre,
                    apellido = :apellido,
                    rol = :rol,
                    activo = :activo,
                    updated_at = now()
                WHERE id = :usuario_id
                RETURNING
                    id,
                    auth_user_id,
                    email,
                    nombre,
                    apellido,
                    rol,
                    activo
                """
            ),
            {
                "usuario_id": usuario_id,
                "email": email,
                "nombre": nombre,
                "apellido": apellido,
                "rol": payload.rol,
                "activo": payload.activo,
            },
        ).mappings().first()

        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "El usuario fue actualizado "
                "en Supabase Auth, pero ocurrió "
                "un error al actualizar "
                "usuarios_autorizados"
            ),
        )

    return {
        "status": "success",
        "usuario": dict(result),
    }


# ============================================================
# CAMBIAR SOLO ESTADO
# SUPERADMIN Y ADMIN
# ============================================================


@router.patch("/{usuario_id}/estado")
def cambiar_estado_usuario(
    usuario_id: str,
    payload: UsuarioEstadoUpdate,
    usuario_actual: dict = Depends(
        require_admin_or_higher
    ),
    db: Session = Depends(get_db),
):
    usuario = db.execute(
        text(
            """
            SELECT
                id,
                auth_user_id,
                email,
                nombre,
                apellido,
                rol,
                activo
            FROM public.usuarios_autorizados
            WHERE id = :usuario_id
            LIMIT 1
            """
        ),
        {
            "usuario_id": usuario_id,
        },
    ).mappings().first()

    if not usuario:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado",
        )

    # Admin no puede cambiar estado de superadmin
    if (
        usuario_actual["rol"] == "admin"
        and usuario["rol"] == "superadmin"
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Un administrador no puede "
                "modificar a un superadministrador"
            ),
        )

    # Nadie puede desactivarse a sí mismo
    if (
        usuario["auth_user_id"]
        == usuario_actual["auth_user_id"]
        and not payload.activo
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes desactivar "
                "tu propia cuenta"
            ),
        )

    try:
        result = db.execute(
            text(
                """
                UPDATE public.usuarios_autorizados
                SET
                    activo = :activo,
                    updated_at = now()
                WHERE id = :usuario_id
                RETURNING
                    id,
                    auth_user_id,
                    email,
                    nombre,
                    apellido,
                    rol,
                    activo
                """
            ),
            {
                "usuario_id": usuario_id,
                "activo": payload.activo,
            },
        ).mappings().first()

        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "No fue posible actualizar "
                "el estado del usuario"
            ),
        )

    return {
        "status": "success",
        "usuario": dict(result),
    }


# ============================================================
# ELIMINAR USUARIO
# SOLO SUPERADMIN
# ============================================================


@router.delete("/{usuario_id}")
def eliminar_usuario(
    usuario_id: str,
    superadmin: dict = Depends(
        require_superadmin
    ),
    db: Session = Depends(get_db),
):
    usuario = db.execute(
        text(
            """
            SELECT
                id,
                auth_user_id,
                email,
                nombre,
                apellido,
                rol,
                activo
            FROM public.usuarios_autorizados
            WHERE id = :usuario_id
            LIMIT 1
            """
        ),
        {
            "usuario_id": usuario_id,
        },
    ).mappings().first()

    if not usuario:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado",
        )

    auth_user_id = usuario["auth_user_id"]

    if (
        auth_user_id
        == superadmin["auth_user_id"]
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes eliminar "
                "tu propio usuario"
            ),
        )

    if (
        not settings.SUPABASE_URL
        or not settings.SUPABASE_SECRET_KEY
    ):
        raise HTTPException(
            status_code=503,
            detail="Supabase no está configurado",
        )

    request = Request(
        (
            f"{settings.SUPABASE_URL.rstrip('/')}"
            f"/auth/v1/admin/users/"
            f"{auth_user_id}"
        ),
        method="DELETE",
        headers={
            "Authorization": (
                f"Bearer "
                f"{settings.SUPABASE_SECRET_KEY}"
            ),
            "apikey": settings.SUPABASE_SECRET_KEY,
        },
    )

    try:
        with urlopen(
            request,
            timeout=10,
        ):
            pass

    except HTTPError as exc:
        body = exc.read().decode(
            "utf-8",
            errors="ignore",
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "No fue posible eliminar "
                "el usuario de Supabase Auth: "
                f"{body}"
            ),
        )

    except (URLError, TimeoutError):
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible conectar "
                "con Supabase Auth"
            ),
        )

    try:
        db.execute(
            text(
                """
                DELETE FROM public.usuarios_autorizados
                WHERE id = :usuario_id
                """
            ),
            {
                "usuario_id": usuario_id,
            },
        )

        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "El usuario fue eliminado "
                "de Supabase Auth, pero no de "
                "usuarios_autorizados"
            ),
        )

    return {
        "status": "success",
        "message": (
            "Usuario eliminado correctamente"
        ),
    }