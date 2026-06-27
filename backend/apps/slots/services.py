import logging
from datetime import time

from apps.slots.models import DeliverySlot

logger = logging.getLogger(__name__)

DEFAULT_SLOTS = {
    "Lunch": {"cutoff_time": time(10, 30), "delivery_start_time": time(12, 0), "delivery_end_time": time(13, 0)},
    "Dinner": {"cutoff_time": time(17, 30), "delivery_start_time": time(19, 0), "delivery_end_time": time(20, 0)},
}


def ensure_default_slots(restaurant, actor=None) -> list[DeliverySlot]:
    created_slots = []
    for name, defaults in DEFAULT_SLOTS.items():
        slot, created = DeliverySlot.objects.get_or_create(
            restaurant=restaurant,
            name=name,
            defaults={**defaults, "is_active": True},
        )
        if created:
            created_slots.append(slot)
            logger.info(
                "default_delivery_slot_created",
                extra={
                    "slot_id": str(slot.id),
                    "restaurant_id": str(restaurant.id),
                    "actor_id": str(actor.id) if actor else None,
                    "slot_name": slot.name,
                },
            )
    return created_slots
