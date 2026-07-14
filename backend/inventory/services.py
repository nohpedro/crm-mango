from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Stock, StockMovement


@transaction.atomic
def register_stock_movement(
    *,
    stock_id,
    movement_type,
    quantity,
    user,
    reference="",
    notes="",
):
    """
    Registra un movimiento y actualiza el stock de manera atómica.
    """

    try:
        stock = (
            Stock.objects
            .select_for_update()
            .select_related(
                "product",
                "warehouse",
            )
            .get(pk=stock_id)
        )
    except Stock.DoesNotExist as error:
        raise ValidationError(
            {
                "stock": (
                    "La existencia seleccionada no existe."
                )
            }
        ) from error

    if movement_type == StockMovement.MovementType.ENTRY:
        quantity_delta = quantity

    elif movement_type == StockMovement.MovementType.EXIT:
        quantity_delta = -quantity

    elif movement_type == StockMovement.MovementType.ADJUSTMENT:
        quantity_delta = quantity

    else:
        raise ValidationError(
            {
                "movement_type": (
                    "El tipo de movimiento no es válido."
                )
            }
        )

    previous_quantity = stock.quantity

    resulting_quantity = (
        previous_quantity + quantity_delta
    )

    if resulting_quantity < 0:
        raise ValidationError(
            {
                "quantity": (
                    "La salida supera el stock físico disponible."
                )
            }
        )

    if resulting_quantity < stock.reserved_quantity:
        raise ValidationError(
            {
                "quantity": (
                    "El stock resultante no puede ser menor "
                    "al stock reservado."
                )
            }
        )

    stock.quantity = resulting_quantity
    stock.full_clean()

    stock.save(
        update_fields=[
            "quantity",
            "updated_at",
        ]
    )

    movement = StockMovement(
        stock=stock,
        movement_type=movement_type,
        quantity_delta=quantity_delta,
        previous_quantity=previous_quantity,
        resulting_quantity=resulting_quantity,
        reference=reference.strip(),
        notes=notes.strip(),
        created_by=user,
    )

    movement.full_clean()
    movement.save()

    return movement