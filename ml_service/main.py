import cv2
import pickle
import cvzone
import numpy as np
import os
import time
import threading
import requests
import json
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
from datetime import datetime
import base64
from dotenv import load_dotenv
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Load environment variables
load_dotenv()

# Configuration
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000/api")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
SAVE_DEBUG_IMAGES = os.getenv("SAVE_DEBUG_IMAGES", "False").lower() == "true"
UPDATE_INTERVAL = int(os.getenv("UPDATE_INTERVAL", "15"))  # Send updates every 15 seconds by default
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))  # Maximum number of worker threads

app = FastAPI(title="Parking Management ML Service")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active processing jobs
active_jobs = {}

# Thread pool for parallel processing
thread_pool = ThreadPoolExecutor(max_workers=MAX_WORKERS)

# Models for API requests and responses
class ParkingLotConfig(BaseModel):
    lot_id: int
    name: str
    location: str
    video_feed_url: str
    parking_spots: List[Dict[str, int]]  # List of parking spot configurations with {id, x, y}

class ParkingSpotDetection(BaseModel):
    spot_id: int
    is_occupied: bool
    confidence: float
    license_plate: Optional[str] = None

class ProcessingResult(BaseModel):
    lot_id: int
    timestamp: str
    detections: List[ParkingSpotDetection]

# Enhanced image processing parameters
class ProcessingParams:
    def __init__(self):
        self.threshold_block_size = 25  # Adaptive threshold block size
        self.threshold_constant = 16    # Threshold constant
        self.median_blur_size = 5       # Median blur kernel size
        self.dilation_iterations = 1    # Number of dilation iterations
        self.empty_threshold = 900      # Pixel count threshold for empty space
        self.width = 103                # Width of parking space
        self.height = 43                # Height of parking space

# Cache for detection results to reduce flickering
class DetectionCache:
    def __init__(self, cache_size=5):
        self.cache_size = cache_size
        self.spot_history = {}  # spot_id -> list of last N occupation statuses
    
    def update(self, spot_id, is_occupied):
        if spot_id not in self.spot_history:
            self.spot_history[spot_id] = []
        
        # Add current status to history
        self.spot_history[spot_id].append(is_occupied)
        
        # Keep only the last N entries
        if len(self.spot_history[spot_id]) > self.cache_size:
            self.spot_history[spot_id].pop(0)
    
    def get_stable_status(self, spot_id):
        if spot_id not in self.spot_history or not self.spot_history[spot_id]:
            return None
        
        # Get majority vote from history
        history = self.spot_history[spot_id]
        occupied_count = sum(1 for status in history if status)
        
        # Return status that appears in majority of frames
        return occupied_count > len(history) / 2

# Core parking detection functionality with improved image processing
def check_spaces(img, imgThres, posList, spot_ids, params, detection_cache):
    """
    Check if parking spaces are occupied
    Returns: list of detections with spot_id and occupancy status
    """
    detections = []
    
    for i, pos in enumerate(posList):
        spot_id = spot_ids[i]
        x, y = pos
        w, h = params.width, params.height

        # Extract region of interest
        imgCrop = imgThres[y:y + h, x:x + w]
        
        # Skip if region is out of bounds
        if imgCrop.size == 0:
            print(f"Warning: Parking spot {spot_id} region is out of bounds")
            continue
        
        # Count non-zero pixels
        count = cv2.countNonZero(imgCrop)

        # Determine if space is occupied (count >= threshold means occupied space)
        is_occupied = count >= params.empty_threshold
        
        # Update detection cache
        detection_cache.update(spot_id, is_occupied)
        
        # Get stable status from cache to reduce flickering
        stable_status = detection_cache.get_stable_status(spot_id)
        if stable_status is not None:
            is_occupied = stable_status
        
        # Calculate confidence based on how far from threshold
        confidence = abs(count - params.empty_threshold) / params.empty_threshold
        confidence = min(max(confidence, 0.5), 0.99)  # Limit between 0.5 and 0.99
        
        # Add detection result
        detections.append(ParkingSpotDetection(
            spot_id=spot_id,
            is_occupied=is_occupied,
            confidence=confidence,
            license_plate=None  # We don't have license plate detection yet
        ))
        
        # Draw rectangles for debugging images
        if DEBUG or SAVE_DEBUG_IMAGES:
            color = (0, 0, 200) if is_occupied else (0, 200, 0)
            thickness = 2 if is_occupied else 5
            cv2.rectangle(img, (x, y), (x + w, y + h), color, thickness)
            cv2.putText(img, str(count), (x, y + h - 6), cv2.FONT_HERSHEY_PLAIN, 1, color, 2)
            cv2.putText(img, str(spot_id), (x, y - 6), cv2.FONT_HERSHEY_PLAIN, 1, (255, 0, 0), 2)
    
    return detections, img

def process_video_frame(frame, posList, spot_ids, params, detection_cache):
    """Process a single video frame and detect parking spaces"""
    if frame is None or frame.size == 0:
        return [], None
    
    try:
        # Image processing pipeline
        imgGray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        imgBlur = cv2.GaussianBlur(imgGray, (3, 3), 1)
        
        # Ensure values are odd for kernel sizes
        block_size = params.threshold_block_size
        if block_size % 2 == 0: block_size += 1
        
        blur_size = params.median_blur_size
        if blur_size % 2 == 0: blur_size += 1
        
        # Use adaptive thresholding
        imgThres = cv2.adaptiveThreshold(
            imgBlur, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 
            block_size, 
            params.threshold_constant
        )
        
        # Apply median blur to reduce noise
        imgThres = cv2.medianBlur(imgThres, blur_size)
        
        # Dilate to connect nearby white pixels
        kernel = np.ones((3, 3), np.uint8)
        imgThres = cv2.dilate(imgThres, kernel, iterations=params.dilation_iterations)
        
        # Check spaces and return detections
        return check_spaces(frame, imgThres, posList, spot_ids, params, detection_cache)
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        return [], None

def process_video_feed(lot_id, video_url, spots, stop_event):
    """
    Process video feed and send results to backend
    This runs in a background thread
    """
    print(f"Starting processing for lot {lot_id} with video URL: {video_url}")
    
    # Extract position list and spot IDs from spots configuration
    posList = [(spot["x"], spot["y"]) for spot in spots]
    spot_ids = [spot["id"] for spot in spots]
    
    # Initialize processing parameters
    params = ProcessingParams()
    
    # Initialize detection cache
    detection_cache = DetectionCache(cache_size=5)
    
    # Open video capture
    cap = None
    retry_count = 0
    max_retries = 5
    
    while retry_count < max_retries and not stop_event.is_set():
        try:
            cap = cv2.VideoCapture(video_url)
            if not cap.isOpened():
                raise Exception(f"Failed to open video stream: {video_url}")
            break
        except Exception as e:
            print(f"Error opening video stream (attempt {retry_count+1}/{max_retries}): {str(e)}")
            retry_count += 1
            time.sleep(5)
    
    if cap is None or not cap.isOpened():
        print(f"Failed to open video stream after {max_retries} attempts: {video_url}")
        return
    
    # Process frames until stopped
    last_update_time = time.time()
    frame_count = 0
    total_frames = 0
    fps_start_time = time.time()
    
    try:
        while not stop_event.is_set():
            # Read frame
            success, frame = cap.read()
            if not success:
                # If end of video or error, reset to beginning or retry
                print(f"Failed to read frame from {video_url}, resetting to beginning")
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                time.sleep(1)  # Wait before retrying
                continue
            
            # Process frame
            detections, annotated_frame = process_video_frame(frame, posList, spot_ids, params, detection_cache)
            
            # Calculate FPS for monitoring
            frame_count += 1
            total_frames += 1
            current_time = time.time()
            elapsed_time = current_time - fps_start_time
            
            if elapsed_time >= 5:  # Calculate FPS every 5 seconds
                fps = frame_count / elapsed_time
                print(f"Lot {lot_id}: Processing at {fps:.2f} FPS")
                frame_count = 0
                fps_start_time = current_time
            
            # Send updates to backend at regular intervals
            if current_time - last_update_time >= UPDATE_INTERVAL:
                # Submit update task to thread pool to avoid blocking
                thread_pool.submit(send_results_to_backend, lot_id, detections)
                last_update_time = current_time
                
                # Save the last processed frame with annotations for debugging
                if SAVE_DEBUG_IMAGES and annotated_frame is not None:
                    debug_dir = "debug_images"
                    os.makedirs(debug_dir, exist_ok=True)
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    cv2.imwrite(f"{debug_dir}/lot_{lot_id}_{timestamp}.jpg", annotated_frame)
            
            # Adaptive frame rate control to avoid excessive CPU usage
            # Process more frames for higher accuracy, but don't overload the system
            skip_frames = max(1, int(total_frames / 1000))  # Skip more frames as we process more
            for _ in range(skip_frames):
                cap.read()  # Skip frames
            
            # Brief sleep to avoid 100% CPU usage
            time.sleep(0.01)
    
    except Exception as e:
        print(f"Error processing video feed for lot {lot_id}: {str(e)}")
    finally:
        if cap is not None:
            cap.release()
        print(f"Stopped processing for lot {lot_id}")

def send_results_to_backend(lot_id, detections):
    """Send detection results to backend API"""
    if not detections:
        print(f"No detections to send for lot {lot_id}")
        return
    
    try:
        # Convert detections to the format expected by the backend
        parking_data = []
        for detection in detections:
            parking_data.append({
                "spot_id": detection.spot_id,
                "is_occupied": detection.is_occupied,
                "confidence": detection.confidence,
                "license_plate": detection.license_plate
            })
        
        # Send data to backend API
        response = requests.post(
            f"{BACKEND_API_URL}/parking-events/ml-update",
            json={
                "lot_id": lot_id,
                "timestamp": datetime.now().isoformat(),
                "detections": parking_data
            },
            timeout=5  # Add timeout to avoid blocking
        )
        
        if response.status_code not in (200, 201):
            print(f"Error updating backend: {response.text}")
        else:
            print(f"Successfully sent {len(detections)} detections to backend for lot {lot_id}")
    
    except requests.exceptions.RequestException as e:
        print(f"Network error sending results to backend: {str(e)}")
    except Exception as e:
        print(f"Error sending results to backend: {str(e)}")

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring service status
    Returns basic service health information
    """
    worker_status = {
        "max_workers": MAX_WORKERS,
        "active_workers": len(active_jobs),
        "available_workers": MAX_WORKERS - len(active_jobs)
    }
    
    # Check if backend API is reachable
    backend_status = "unknown"
    backend_message = ""
    try:
        # Just try to connect, don't need a valid endpoint
        response = requests.head(BACKEND_API_URL, timeout=2)
        backend_status = "connected" if response.status_code < 500 else "error"
    except Exception as e:
        backend_status = "unreachable"
        backend_message = str(e)
    
    system_info = {
        "opencv_version": cv2.__version__,
        "python_threads": threading.active_count(),
        "update_interval_seconds": UPDATE_INTERVAL
    }
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "parking-ml",
        "version": "1.1",
        "active_jobs": len(active_jobs),
        "workers": worker_status,
        "backend_connection": {
            "status": backend_status,
            "api_url": BACKEND_API_URL,
            "message": backend_message
        },
        "system": system_info
    }

# FastAPI routes
@app.get("/")
async def root():
    return {"message": "Welcome to Parking Management ML Service", "version": "1.1"}

@app.post("/config/parking-lot")
async def configure_parking_lot(config: ParkingLotConfig, background_tasks: BackgroundTasks):
    """
    Configure a new parking lot for processing
    """
    lot_id = config.lot_id
    
    # Stop any existing processing job for this lot
    if lot_id in active_jobs:
        active_jobs[lot_id]["stop_event"].set()
        # Wait a moment for the thread to stop
        time.sleep(1)
    
    # Create a stop event for the new job
    stop_event = threading.Event()
    
    # Create a new background thread for processing
    process_thread = threading.Thread(
        target=process_video_feed,
        args=(lot_id, config.video_feed_url, config.parking_spots, stop_event)
    )
    
    # Store job information
    active_jobs[lot_id] = {
        "thread": process_thread,
        "stop_event": stop_event,
        "config": config.dict(),
        "started_at": datetime.now().isoformat()
    }
    
    # Start processing
    process_thread.daemon = True
    process_thread.start()
    
    return {
        "message": "Parking lot configuration accepted",
        "lot_id": lot_id,
        "status": "processing",
        "started_at": active_jobs[lot_id]["started_at"]
    }

@app.delete("/config/parking-lot/{lot_id}")
async def stop_processing(lot_id: int):
    """
    Stop processing for a parking lot
    """
    if lot_id not in active_jobs:
        raise HTTPException(status_code=404, detail=f"No active processing for lot ID {lot_id}")
    
    # Stop the processing thread
    active_jobs[lot_id]["stop_event"].set()
    
    # Store the config temporarily for the response
    config = active_jobs[lot_id]["config"]
    started_at = active_jobs[lot_id]["started_at"]
    
    # Remove from active jobs
    del active_jobs[lot_id]
    
    return {
        "message": f"Processing stopped for lot ID {lot_id}",
        "lot_id": lot_id,
        "video_url": config["video_feed_url"],
        "started_at": started_at,
        "stopped_at": datetime.now().isoformat()
    }

@app.get("/status")
async def get_status():
    """
    Get status of all processing jobs
    """
    status_info = {
        "active_jobs": len(active_jobs),
        "job_details": []
    }
    
    for lot_id, job_info in active_jobs.items():
        config = job_info["config"]
        status_info["job_details"].append({
            "lot_id": lot_id,
            "lot_name": config["name"],
            "video_url": config["video_feed_url"],
            "spots_count": len(config["parking_spots"]),
            "started_at": job_info["started_at"],
            "thread_alive": job_info["thread"].is_alive()
        })
    
    return status_info

@app.post("/test/single-image")
async def test_single_image(file: UploadFile = File(...), lot_id: int = Form(...)):
    """
    Test processing on a single uploaded image
    """
    if lot_id not in active_jobs:
        raise HTTPException(status_code=404, detail=f"No configuration for lot ID {lot_id}")
    
    # Read the uploaded image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Get the lot configuration
    config = active_jobs[lot_id]["config"]
    posList = [(spot["x"], spot["y"]) for spot in config["parking_spots"]]
    spot_ids = [spot["id"] for spot in config["parking_spots"]]
    
    # Initialize processing parameters and detection cache
    params = ProcessingParams()
    detection_cache = DetectionCache(cache_size=1)  # Single image, so cache size of 1
    
    # Process the image
    detections, annotated_img = process_video_frame(img, posList, spot_ids, params, detection_cache)
    
    # Convert the annotated image to base64 for response
    _, buffer = cv2.imencode('.jpg', annotated_img)
    img_str = base64.b64encode(buffer).decode('utf-8')
    
    return {
        "lot_id": lot_id,
        "detections": [detection.dict() for detection in detections],
        "annotated_image": f"data:image/jpeg;base64,{img_str}"
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=DEBUG)