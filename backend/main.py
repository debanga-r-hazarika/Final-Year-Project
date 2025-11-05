from fastapi import FastAPI, Depends, HTTPException, status, Query, BackgroundTasks, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime
import uvicorn
import os
import requests
import json
import sys
import subprocess
from pathlib import Path
import pickle

# Import local modules (to be created)
from database import get_db
from models import models
from schemas import schemas
from auth import auth
import websocket  # Import the websocket module

app = FastAPI(title="Parking Management System API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(websocket.router, tags=["WebSocket"])  # Include the WebSocket router

@app.get("/")
async def root():
    return {"message": "Welcome to Parking Management System API"}

@app.get("/api/parking-spots", response_model=List[schemas.ParkingSpot])
async def get_parking_spots(db: Session = Depends(get_db)):
    """Get all available parking spots"""
    spots = db.query(models.ParkingSpot).all()
    return spots

@app.post("/api/parking-spots", response_model=schemas.ParkingSpot, status_code=status.HTTP_201_CREATED)
async def create_parking_spot(
    spot_data: schemas.ParkingSpotCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Create new parking spot with video feed URL"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can create parking spots")
    
    new_spot = models.ParkingSpot(
        name=spot_data.name,
        location=spot_data.location,
        spot_type=spot_data.spot_type,
        coordinates_x=spot_data.coordinates_x,
        coordinates_y=spot_data.coordinates_y,
        video_feed_url=spot_data.video_feed_url,
        lot_id=spot_data.lot_id
    )
    db.add(new_spot)
    db.commit()
    db.refresh(new_spot)
    
    # Trigger ML processing if video URL exists
    if new_spot.video_feed_url:
        ml_service_url = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
        background_tasks.add_task(
            requests.post,
            f"{ml_service_url}/process-video",
            json={"video_url": new_spot.video_feed_url}
        )
    
    return new_spot

@app.get("/api/parking-spots/{spot_id}", response_model=schemas.ParkingSpot)
async def get_parking_spot(spot_id: int, db: Session = Depends(get_db)):
    """Get a specific parking spot by ID"""
    spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Parking spot not found")
    return spot

@app.post("/api/reservations", response_model=schemas.Reservation)
async def create_reservation(reservation: schemas.ReservationCreate, db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    """Create a new parking reservation"""
    # Check if spot is available
    spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == reservation.spot_id).first()
    if not spot or not spot.is_available:
        raise HTTPException(status_code=400, detail="Parking spot not available")
    
    # Create reservation
    db_reservation = models.Reservation(
        user_id=current_user.id,
        spot_id=reservation.spot_id,
        start_time=reservation.start_time,
        end_time=reservation.end_time
    )
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    
    # Update spot availability
    spot.is_available = False
    db.commit()
    
    return db_reservation

@app.get("/api/reservations", response_model=List[schemas.Reservation])
async def get_user_reservations(db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    """Get all reservations for the current user"""
    reservations = db.query(models.Reservation).filter(models.Reservation.user_id == current_user.id).all()
    return reservations

@app.put("/api/reservations/{reservation_id}", response_model=schemas.Reservation)
async def update_reservation(reservation_id: int, status: str, db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    """Update a reservation status (cancel or complete)"""
    # Check if reservation exists and belongs to user
    reservation = db.query(models.Reservation).filter(
        models.Reservation.id == reservation_id,
        models.Reservation.user_id == current_user.id
    ).first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    # Update reservation status
    if status not in ["active", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status value")
    
    reservation.status = status
    
    # If cancelled or completed, make the spot available again
    if status in ["completed", "cancelled"]:
        spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == reservation.spot_id).first()
        if spot:
            spot.is_available = True
    
    db.commit()
    db.refresh(reservation)
    return reservation

# Vehicle management endpoints
@app.post("/api/vehicles", response_model=schemas.Vehicle)
async def create_vehicle(vehicle: schemas.VehicleCreate, db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    """Register a new vehicle for the current user"""
    # Check if license plate already exists
    existing_vehicle = db.query(models.Vehicle).filter(models.Vehicle.license_plate == vehicle.license_plate).first()
    if existing_vehicle:
        raise HTTPException(status_code=400, detail="License plate already registered")
    
    # Create new vehicle
    db_vehicle = models.Vehicle(
        owner_id=current_user.id,
        license_plate=vehicle.license_plate,
        make=vehicle.make,
        model=vehicle.model,
        color=vehicle.color
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@app.get("/api/vehicles", response_model=List[schemas.Vehicle])
async def get_user_vehicles(db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    """Get all vehicles for the current user"""
    vehicles = db.query(models.Vehicle).filter(models.Vehicle.owner_id == current_user.id).all()
    return vehicles

@app.delete("/api/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), current_user = Depends(auth.get_current_user)):
    """Delete a vehicle"""
    # Check if vehicle exists and belongs to user
    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.id == vehicle_id,
        models.Vehicle.owner_id == current_user.id
    ).first()
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check if vehicle has active reservations
    active_reservations = db.query(models.Reservation).filter(
        models.Reservation.vehicle_id == vehicle_id,
        models.Reservation.status == "active"
    ).first()
    
    if active_reservations:
        raise HTTPException(status_code=400, detail="Cannot delete vehicle with active reservations")
    
    # Delete vehicle
    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle deleted successfully"}

# Parking events endpoints
@app.post("/api/parking-events", response_model=schemas.ParkingEvent, status_code=201)
async def create_parking_event(event: schemas.ParkingEventCreate, db: Session = Depends(get_db)):
    """Create a new parking event (entry)"""
    # Check if spot exists
    spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == event.spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Parking spot not found")
    
    # Check if there's already an active event for this spot
    active_event = db.query(models.ParkingEvent).filter(
        models.ParkingEvent.spot_id == event.spot_id,
        models.ParkingEvent.is_active == True
    ).first()
    
    if active_event:
        raise HTTPException(status_code=400, detail="Spot already has an active parking event")
    
    # Try to find vehicle by license plate if provided
    vehicle_id = None
    if event.license_plate:
        vehicle = db.query(models.Vehicle).filter(models.Vehicle.license_plate == event.license_plate).first()
        if vehicle:
            vehicle_id = vehicle.id
    
    # Create parking event
    db_event = models.ParkingEvent(
        spot_id=event.spot_id,
        vehicle_id=vehicle_id,
        license_plate=event.license_plate,
        entry_time=event.entry_time,
        is_active=True,
        detected_by_ml=getattr(event, 'detected_by_ml', False)
    )
    db.add(db_event)
    
    # Update spot availability
    spot.is_available = False
    
    db.commit()
    db.refresh(db_event)
    return db_event

@app.put("/api/parking-events/{event_id}/exit", response_model=schemas.ParkingEvent)
async def record_exit(event_id: int, db: Session = Depends(get_db)):
    """Record a vehicle exit"""
    # Find the parking event
    event = db.query(models.ParkingEvent).filter(
        models.ParkingEvent.id == event_id,
        models.ParkingEvent.is_active == True
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Active parking event not found")
    
    # Update event
    event.exit_time = datetime.now()
    event.is_active = False
    
    # Make spot available again
    spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == event.spot_id).first()
    if spot:
        spot.is_available = True
    
    db.commit()
    db.refresh(event)
    return event

@app.get("/api/parking-events", response_model=List[schemas.ParkingEvent])
async def get_parking_events(
    is_active: Optional[bool] = None,
    license_plate: Optional[str] = None,
    spot_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    """Get parking events with optional filters"""
    # Build query with filters
    query = db.query(models.ParkingEvent)
    
    if is_active is not None:
        query = query.filter(models.ParkingEvent.is_active == is_active)
    
    if license_plate:
        query = query.filter(models.ParkingEvent.license_plate == license_plate)
    
    if spot_id:
        query = query.filter(models.ParkingEvent.spot_id == spot_id)
    
    events = query.order_by(models.ParkingEvent.entry_time.desc()).all()
    return events

# Admin endpoints
@app.post("/api/admin/parking-spots", response_model=schemas.ParkingSpot)
async def create_parking_spot(
    spot: schemas.ParkingSpotCreate, 
    db: Session = Depends(get_db), 
    current_user = Depends(auth.get_current_user)
):
    """Create a new parking spot (admin only)"""
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create new spot
    db_spot = models.ParkingSpot(
        name=spot.name,
        location=spot.location,
        spot_type=spot.spot_type,
        coordinates_x=spot.coordinates_x,
        coordinates_y=spot.coordinates_y,
        is_available=True
    )
    db.add(db_spot)
    db.commit()
    db.refresh(db_spot)
    return db_spot

@app.put("/api/admin/parking-spots/{spot_id}", response_model=schemas.ParkingSpot)
async def update_parking_spot(
    spot_id: int,
    spot: schemas.ParkingSpotCreate,
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    """Update a parking spot (admin only)"""
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find spot
    db_spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == spot_id).first()
    if not db_spot:
        raise HTTPException(status_code=404, detail="Parking spot not found")
    
    # Update spot
    db_spot.name = spot.name
    db_spot.location = spot.location
    db_spot.spot_type = spot.spot_type
    db_spot.coordinates_x = spot.coordinates_x
    db_spot.coordinates_y = spot.coordinates_y
    
    db.commit()
    db.refresh(db_spot)
    return db_spot

@app.delete("/api/admin/parking-spots/{spot_id}")
async def delete_parking_spot(
    spot_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    """Delete a parking spot (admin only)"""
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find spot
    spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == spot_id).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Parking spot not found")
    
    # Check if spot has active reservations or events
    active_reservation = db.query(models.Reservation).filter(
        models.Reservation.spot_id == spot_id,
        models.Reservation.status == "active"
    ).first()
    
    active_event = db.query(models.ParkingEvent).filter(
        models.ParkingEvent.spot_id == spot_id,
        models.ParkingEvent.is_active == True
    ).first()
    
    if active_reservation or active_event:
        raise HTTPException(status_code=400, detail="Cannot delete spot with active reservations or events")
    
    # Delete spot
    db.delete(spot)
    db.commit()
    return {"message": "Parking spot deleted successfully"}

@app.get("/api/admin/users", response_model=List[schemas.User])
async def get_all_users(
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Get all users (admin only)"""
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@app.put("/api/admin/users/{user_id}/admin", response_model=schemas.User)
async def toggle_admin_status(
    user_id: int,
    is_admin: bool,
    db: Session = Depends(get_db),
    current_user = Depends(auth.get_current_user)
):
    """Toggle admin status for a user (admin only)"""
    # Check if current user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find user
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update admin status
    user.is_admin = is_admin
    db.commit()
    db.refresh(user)
    return user

# ML Service integration endpoints
@app.post("/api/parking-events/ml-update", status_code=status.HTTP_200_OK)
async def update_from_ml_service(update_data: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Receive parking spot updates from ML service and update database
    """
    lot_id = update_data.get("lot_id")
    timestamp = update_data.get("timestamp")
    detections = update_data.get("detections", [])
    
    # Process each detection
    for detection in detections:
        spot_id = detection.get("spot_id")
        is_occupied = detection.get("is_occupied")
        license_plate = detection.get("license_plate")
        
        # Get the parking spot
        spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == spot_id).first()
        if not spot:
            continue
        
        # Update ML status
        spot.ml_status = "occupied" if is_occupied else "empty"
        spot.last_ml_update = datetime.now()
        
        # If the availability has changed, update it
        if spot.is_available == is_occupied:  # Status changed
            spot.is_available = not is_occupied
            
            # If spot is newly occupied, create a parking event
            if is_occupied:
                # Check if there's already an active event
                active_event = db.query(models.ParkingEvent).filter(
                    models.ParkingEvent.spot_id == spot_id,
                    models.ParkingEvent.is_active == True
                ).first()
                
                if not active_event:
                    # Try to find vehicle by license plate if provided
                    vehicle_id = None
                    if license_plate:
                        vehicle = db.query(models.Vehicle).filter(models.Vehicle.license_plate == license_plate).first()
                        if vehicle:
                            vehicle_id = vehicle.id
                    
                    # Create new parking event
                    new_event = models.ParkingEvent(
                        spot_id=spot_id,
                        vehicle_id=vehicle_id,
                        license_plate=license_plate,
                        entry_time=datetime.now(),
                        is_active=True,
                        detected_by_ml=True
                    )
                    db.add(new_event)
            
            # If spot is newly vacant, update existing event
            elif not is_occupied:
                active_event = db.query(models.ParkingEvent).filter(
                    models.ParkingEvent.spot_id == spot_id,
                    models.ParkingEvent.is_active == True
                ).first()
                
                if active_event:
                    active_event.exit_time = datetime.now()
                    active_event.is_active = False
    
    # Commit all changes
    db.commit()
    
    # Broadcast updates via WebSocket (in background to avoid blocking)
    background_tasks.add_task(broadcast_parking_updates, db)
    
    return {"message": "Parking data updated", "processed_detections": len(detections)}

async def broadcast_parking_updates(db: Session):
    """
    Broadcast parking updates to all connected WebSocket clients
    """
    try:
        # Get all parking spots with their lots for context
        spots_data = []
        spots = db.query(models.ParkingSpot).all()
        
        for spot in spots:
            # Get the lot information
            lot = db.query(models.ParkingLot).filter(models.ParkingLot.id == spot.lot_id).first()
            lot_name = lot.name if lot else "Unknown"
            lot_location = lot.location if lot else "Unknown"
            
            # Get active reservation if any
            active_reservation = db.query(models.Reservation).filter(
                models.Reservation.spot_id == spot.id,
                models.Reservation.status == "active"
            ).first()
            
            # Get current parking event if any
            active_event = db.query(models.ParkingEvent).filter(
                models.ParkingEvent.spot_id == spot.id,
                models.ParkingEvent.is_active == True
            ).first()
            
            spots_data.append({
                "id": spot.id,
                "name": spot.name,
                "lot_id": spot.lot_id,
                "lot_name": lot_name,
                "lot_location": lot_location,
                "is_available": spot.is_available,
                "spot_type": spot.spot_type,
                "coordinates_x": spot.coordinates_x,
                "coordinates_y": spot.coordinates_y,
                "ml_status": spot.ml_status,
                "last_ml_update": spot.last_ml_update.isoformat() if spot.last_ml_update else None,
                "has_active_reservation": active_reservation is not None,
                "has_active_event": active_event is not None,
                "license_plate": active_event.license_plate if active_event else None
            })
        
        # Send message to all connected clients
        await websocket.manager.broadcast(json.dumps({
            "type": "parking_update",
            "timestamp": datetime.now().isoformat(),
            "data": spots_data
        }))
        
    except Exception as e:
        print(f"Error broadcasting parking updates: {str(e)}")

# Admin endpoints to configure ML service
@app.post("/api/admin/parking-lots/ml-config", response_model=schemas.ParkingLot)
async def configure_ml_for_parking_lot(
    config_data: schemas.ParkingLotMLConfig,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Configure ML service for a parking lot
    Admin only endpoint
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can configure ML integration")
    
    # Check if the parking lot exists
    lot = db.query(models.ParkingLot).filter(models.ParkingLot.id == config_data.lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    
    # Get all spots for this lot
    spots = db.query(models.ParkingSpot).filter(models.ParkingSpot.lot_id == lot.id).all()
    
    # Prepare data for ML service
    parking_spots = []
    for spot in spots:
        parking_spots.append({
            "id": spot.id,
            "x": int(spot.coordinates_x),
            "y": int(spot.coordinates_y)
        })
    
    # Call ML service to configure
    ml_service_url = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
    try:
        response = requests.post(
            f"{ml_service_url}/config/parking-lot",
            json={
                "lot_id": lot.id,
                "name": lot.name,
                "location": lot.location,
                "video_feed_url": config_data.video_feed_url,
                "parking_spots": parking_spots
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to configure ML service: {response.text}"
            )
        
        # Update lot with new video feed URL
        lot.video_feed_url = config_data.video_feed_url
        db.commit()
        
        return lot
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error configuring ML service: {str(e)}"
        )

@app.delete("/api/admin/parking-lots/{lot_id}/ml-config")
async def stop_ml_processing(
    lot_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Stop ML processing for a parking lot
    Admin only endpoint
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can stop ML processing")
    
    # Check if the parking lot exists
    lot = db.query(models.ParkingLot).filter(models.ParkingLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    
    # Call ML service to stop processing
    ml_service_url = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
    try:
        response = requests.delete(f"{ml_service_url}/config/parking-lot/{lot_id}")
        
        if response.status_code not in (200, 404):
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to stop ML service: {response.text}"
            )
        
        return {"message": f"ML processing stopped for lot ID {lot_id}"}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error stopping ML service: {str(e)}"
        )

@app.get("/api/admin/ml-service/status")
async def get_ml_service_status(
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get the status of the ML service
    Admin only endpoint
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can check ML service status")
    
    # Call ML service to get status
    ml_service_url = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
    try:
        response = requests.get(f"{ml_service_url}/status")
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to get ML service status: {response.text}"
            )
        
        return response.json()
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting ML service status: {str(e)}"
        )

@app.get("/api/admin/ml-service/health")
async def check_ml_service_health(
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Check if ML service is up and running
    Admin only endpoint
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can check ML service health")
    
    ml_service_url = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
    
    try:
        # First, try the dedicated health endpoint
        response = requests.get(f"{ml_service_url}/health", timeout=3)
        
        if response.status_code == 200:
            # Parse the JSON response if available
            try:
                health_data = response.json()
                return {
                    "status": "healthy",
                    "message": "ML service is running and healthy",
                    "details": health_data
                }
            except:
                # If can't parse JSON but status is 200, still consider healthy
                return {
                    "status": "healthy",
                    "message": "ML service is running but returned non-JSON response"
                }
        else:
            # Try a fallback status endpoint if the health endpoint fails
            try:
                status_response = requests.get(f"{ml_service_url}/status", timeout=2)
                if status_response.status_code == 200:
                    return {
                        "status": "healthy",
                        "message": "ML service is running (via status endpoint)"
                    }
            except:
                pass
                
            return {
                "status": "unhealthy",
                "message": f"ML service responded with status {response.status_code}"
            }
        
    except requests.exceptions.ConnectTimeout:
        return {
            "status": "unreachable", 
            "message": "Connection timed out. ML service might be starting up or overloaded."
        }
    except requests.exceptions.ConnectionError:
        return {
            "status": "unreachable", 
            "message": "Connection refused. ML service may not be running."
        }
    except Exception as e:
        return {
            "status": "unreachable", 
            "message": f"Cannot connect to ML service: {str(e)}"
        }

@app.get("/api/admin/parking-lots", response_model=List[schemas.ParkingLot])
async def get_admin_parking_lots(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get all parking lots (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access this endpoint")
    
    lots = db.query(models.ParkingLot).all()
    return lots

@app.get("/api/parking-lots", response_model=List[schemas.ParkingLot])
async def get_parking_lots(db: Session = Depends(get_db)):
    """Get all parking lots (public endpoint)"""
    lots = db.query(models.ParkingLot).all()
    return lots

@app.post("/api/admin/parking-lots", response_model=schemas.ParkingLot)
async def create_parking_lot(
    lot_data: schemas.ParkingLotCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Create a new parking lot (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can create parking lots")
    
    new_lot = models.ParkingLot(
        name=lot_data.name,
        location=lot_data.location,
        total_spots=lot_data.total_spots
    )
    db.add(new_lot)
    db.commit()
    db.refresh(new_lot)
    
    return new_lot

@app.post("/api/admin/parking-lots/spots-config")
async def configure_parking_spots(
    lot_id: int = Form(...),
    spots_data: str = Form(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Configure parking spots for a lot based on YouTube video frame selection
    Admin only endpoint
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can configure parking spots")
    
    # Check if the parking lot exists
    db = next(get_db())
    lot = db.query(models.ParkingLot).filter(models.ParkingLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    
    try:
        # Parse the spots data
        spots = json.loads(spots_data)
        
        # Create/update spots in the database
        for spot in spots:
            # Check if spot already exists by position
            existing_spot = db.query(models.ParkingSpot).filter(
                models.ParkingSpot.lot_id == lot_id,
                models.ParkingSpot.coordinates_x == spot["x"],
                models.ParkingSpot.coordinates_y == spot["y"]
            ).first()
            
            if existing_spot:
                # Update existing spot
                existing_spot.is_available = True
                existing_spot.ml_status = "empty"
            else:
                # Create new spot
                new_spot = models.ParkingSpot(
                    name=f"Spot {spot['id']}",
                    location=lot.location,
                    spot_type="Standard",
                    coordinates_x=spot["x"],
                    coordinates_y=spot["y"],
                    is_available=True,
                    ml_status="empty",
                    last_ml_update=datetime.now(),
                    lot_id=lot_id
                )
                db.add(new_spot)
        
        db.commit()
        
        return {"message": f"Successfully configured {len(spots)} parking spots for lot ID {lot_id}"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error configuring parking spots: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)