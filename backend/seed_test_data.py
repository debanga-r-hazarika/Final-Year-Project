import os
import sys
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
from models import models
from auth.auth import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_test_data():
    """Seed the database with test data for development"""
    logger.info("Seeding test data...")
    
    # Create a database session
    db = SessionLocal()
    
    try:
        # Create test parking lot with real coordinates
        # Using coordinates for a university campus as an example
        campus_lat = 51.5074  # Example: London coordinates
        campus_lng = -0.1278
        
        test_lot = models.ParkingLot(
            name="University Campus Parking",
            location="University Campus",
            total_spots=6,
            video_feed_url="https://www.youtube.com/watch?v=mwN6l3O1MNI"  # Example video feed
        )
        db.add(test_lot)
        db.flush()  # Flush to get the lot ID
        
        logger.info(f"Created test parking lot with ID: {test_lot.id}")
        
        # Create test parking spots in the lot with realistic GPS coordinates
        spots = []
        spot_types = ["regular", "regular", "handicapped", "electric", "regular", "reserved"]
        
        # Create a small parking lot layout with spots in two rows
        for i in range(1, 7):
            # Create a grid of spots with realistic GPS offsets
            row = (i-1) // 3
            col = (i-1) % 3
            
            # Small GPS offsets (approximately 10-20 meters apart)
            # 0.0001 degrees is roughly 10 meters
            lat_offset = row * 0.0001
            lng_offset = col * 0.0001
            
            spot = models.ParkingSpot(
                lot_id=test_lot.id,
                name=f"A{i}",
                location="University Campus",
                spot_type=spot_types[i-1],
                is_available=i % 2 == 0,  # Alternate available/occupied for demo
                coordinates_x=campus_lat + lat_offset,
                coordinates_y=campus_lng + lng_offset,
                ml_status="empty" if i % 2 == 0 else "occupied"
            )
            spots.append(spot)
            db.add(spot)
        
        logger.info(f"Created {len(spots)} parking spots with realistic coordinates")
        
        # Create a test user if none exists
        test_user = db.query(models.User).filter(models.User.email == "testuser@example.com").first()
        if not test_user:
            test_user = models.User(
                email="testuser@example.com",
                username="testuser",
                hashed_password=get_password_hash("password123"),
                is_active=True,
                is_admin=False
            )
            db.add(test_user)
            logger.info("Created test user")
        
        # Commit changes
        db.commit()
        logger.info("Test data seeded successfully!")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding test data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_data() 