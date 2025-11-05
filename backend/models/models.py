from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Float
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    # Relationships
    reservations = relationship("Reservation", back_populates="user")
    vehicles = relationship("Vehicle", back_populates="owner")

class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    location = Column(String, index=True)
    total_spots = Column(Integer, default=0)
    video_feed_url = Column(String, nullable=True, comment="URL for the lot's video feed (RTSP/HTTP/YouTube)")
    last_ml_update = Column(DateTime, nullable=True)  # Last time ML service updated the status
    
    # Relationships
    spots = relationship("ParkingSpot", back_populates="lot")

class ParkingSpot(Base):
    __tablename__ = "parking_spots"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=True)
    name = Column(String, index=True)
    location = Column(String, index=True, nullable=False, server_default='Unspecified Location')
    is_available = Column(Boolean, default=True)
    spot_type = Column(String)  # regular, handicapped, electric, etc.
    coordinates_x = Column(Float, nullable=False)  # X coordinate in parking lot map
    coordinates_y = Column(Float, nullable=False)  # Y coordinate in parking lot map
    ml_status = Column(String, nullable=True, comment="Current status from ML service: occupied|empty|unknown")
    last_ml_update = Column(DateTime, nullable=True)  # Last time ML service updated the status
    video_feed_url = Column(String, nullable=True)  # URL for video feed
    
    # Relationships
    lot = relationship("ParkingLot", back_populates="spots")
    reservations = relationship("Reservation", back_populates="spot")

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    spot_id = Column(Integer, ForeignKey("parking_spots.id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="active")  # active, completed, cancelled
    
    # Relationships
    user = relationship("User", back_populates="reservations")
    spot = relationship("ParkingSpot", back_populates="reservations")
    vehicle = relationship("Vehicle", back_populates="reservations")

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    license_plate = Column(String, unique=True, index=True)
    make = Column(String)
    model = Column(String)
    color = Column(String)
    
    # Relationships
    owner = relationship("User", back_populates="vehicles")
    reservations = relationship("Reservation", back_populates="vehicle")

class ParkingEvent(Base):
    __tablename__ = "parking_events"

    id = Column(Integer, primary_key=True, index=True)
    spot_id = Column(Integer, ForeignKey("parking_spots.id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    license_plate = Column(String, nullable=True)  # In case vehicle is not registered
    entry_time = Column(DateTime)
    exit_time = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    detected_by_ml = Column(Boolean, default=False)  # Whether detected by ML system
    
    # Relationships
    spot = relationship("ParkingSpot")
    vehicle = relationship("Vehicle")