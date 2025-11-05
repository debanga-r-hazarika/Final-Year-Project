from database import get_db
from models.models import User
from auth.auth import get_password_hash

def create_admin():
    db = next(get_db())
    admin_user = User(
        email="admin@parking.com",
        username="admin",
        hashed_password=get_password_hash("admin123"),
        is_admin=True
    )
    db.add(admin_user)
    db.commit()
    print("Admin user created successfully")

if __name__ == "__main__":
    create_admin()