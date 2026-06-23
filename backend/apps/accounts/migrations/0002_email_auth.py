from django.db import migrations, models


def populate_email(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.all():
        if not user.email:
            user.email = f"{user.phone or user.id}@preplate.local"
            user.save(update_fields=["email"])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(populate_email, reverse_noop),
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(max_length=254, unique=True),
        ),
        migrations.AlterField(
            model_name="user",
            name="phone",
            field=models.CharField(blank=True, max_length=10, null=True, unique=True),
        ),
    ]
