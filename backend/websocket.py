from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import List, Dict
import json
from datetime import datetime

from database import get_db
from models import models
from schemas import schemas

# Create router
router = APIRouter()

# Store active connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                # Parse the received data
                parking_data = json.loads(data)
                
                # Process parking spot updates
                if isinstance(parking_data, list):
                    for spot_data in parking_data:
                        spot_id = spot_data.get("spot_id")
                        is_occupied = spot_data.get("is_occupied")
                        license_plate = spot_data.get("license_plate")
                        
                        # Update spot in database
                        spot = db.query(models.ParkingSpot).filter(models.ParkingSpot.id == spot_id).first()
                        if spot:
                            # Update availability
                            spot.is_available = not is_occupied
                            db.commit()
                            
                            # If spot is newly occupied, create a parking event
                            if is_occupied and license_plate:
                                # Check if there's already an active event
                                active_event = db.query(models.ParkingEvent).filter(
                                    models.ParkingEvent.spot_id == spot_id,
                                    models.ParkingEvent.is_active == True
                                ).first()
                                
                                if not active_event:
                                    # Try to find vehicle by license plate
                                    vehicle_id = None
                                    vehicle = db.query(models.Vehicle).filter(
                                        models.Vehicle.license_plate == license_plate
                                    ).first()
                                    
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
                                    db.commit()
                            
                            # If spot is newly vacant, update existing event
                            elif not is_occupied:
                                active_event = db.query(models.ParkingEvent).filter(
                                    models.ParkingEvent.spot_id == spot_id,
                                    models.ParkingEvent.is_active == True
                                ).first()
                                
                                if active_event:
                                    active_event.exit_time = datetime.now()
                                    active_event.is_active = False
                                    db.commit()
                
                # Broadcast updated data to all clients
                spots = db.query(models.ParkingSpot).all()
                spots_data = [{
                    "id": spot.id,
                    "name": spot.name,
                    "is_available": spot.is_available,
                    "spot_type": spot.spot_type,
                    "coordinates_x": spot.coordinates_x,
                    "coordinates_y": spot.coordinates_y
                } for spot in spots]
                
                await manager.broadcast(json.dumps(spots_data))
                
            except Exception as e:
                await websocket.send_text(f"Error processing data: {str(e)}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)