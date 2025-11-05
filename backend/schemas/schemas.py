from pydantic import BaseModel, EmailStr, Field, HttpUrl
from typing import List, Optional, Dict, Any
from datetime import datetime

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool

    class Config:
        from_attributes = True

# Vehicle schemas
class VehicleBase(BaseModel):
    license_plate: str
    make: str
    model: str
    color: str

class VehicleCreate(VehicleBase):
    pass

class Vehicle(VehicleBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True

# Parking spot schemas
class ParkingSpotBase(BaseModel):
    name: str
    location: str
    spot_type: str
    coordinates_x: Optional[float] = None
    coordinates_y: Optional[float] = None

class ParkingSpotCreate(ParkingSpotBase):
    video_feed_url: Optional[str] = Field(
        None,
        description="YouTube live stream URL for video feed analysis",
        pattern=r'^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$'
    )
    lot_id: Optional[int] = None

class ParkingSpot(ParkingSpotBase):
    id: int
    is_available: bool

    class Config:
        from_attributes = True

# Reservation schemas
class ReservationBase(BaseModel):
    spot_id: int
    start_time: datetime
    end_time: datetime

class ReservationCreate(ReservationBase):
    vehicle_id: Optional[int] = None

class Reservation(ReservationBase):
    id: int
    user_id: int
    status: str
    vehicle_id: Optional[int] = None

    class Config:
        from_attributes = True

# Parking event schemas
class ParkingEventBase(BaseModel):
    spot_id: int
    entry_time: datetime
    license_plate: Optional[str] = None

class ParkingEventCreate(ParkingEventBase):
    pass

class ParkingEvent(ParkingEventBase):
    id: int
    exit_time: Optional[datetime] = None
    is_active: bool
    detected_by_ml: bool
    vehicle_id: Optional[int] = None

    class Config:
        from_attributes = True

# Parking Lot schemas
class ParkingLotBase(BaseModel):
    name: str
    location: str
    total_spots: int

class ParkingLotCreate(ParkingLotBase):
    pass

class ParkingLot(ParkingLotBase):
    id: int
    video_feed_url: Optional[str] = None
    last_ml_update: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# ML Service Configuration schema
class ParkingLotMLConfig(BaseModel):
    lot_id: int
    video_feed_url: str = Field(
        description="URL for the video feed (RTSP, HTTP, or YouTube)"
    )
    
class MLDetectionUpdate(BaseModel):
    lot_id: int
    timestamp: datetime
    detections: List[Dict[str, Any]]

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None