# Parking Management ML Service

## Overview
This ML service processes video feeds from parking lots to detect and track parking space occupancy in semi-real-time. The system uses computer vision techniques with OpenCV to analyze parking spaces and detect whether they are occupied or vacant. Results are sent to the backend API for integration with the parking management system.

## Features
- **Real-time detection**: Processes video feeds to determine parking space occupancy
- **Semi-real-time updates**: Updates backend every 15 seconds (configurable)
- **Adaptive image processing**: Optimized for different lighting conditions
- **Space status stabilization**: Uses temporal averaging to reduce flickering and false detections
- **Parallel processing**: Utilizes thread pooling for multiple lots processing
- **API integration**: RESTful API for configuration and status monitoring
- **Debugging tools**: Optional debug image saving for troubleshooting

## System Architecture

### Core Components
1. **Video Processing Engine**
   - Processes video feeds using adaptive image processing techniques
   - Analyzes individual parking spaces within each frame
   - Maintains a history of space statuses to reduce flickering

2. **Background Processing System**
   - Manages multiple parking lots simultaneously
   - Uses thread pooling for efficient resource utilization
   - Ensures consistent performance without overwhelming the system

3. **Backend Integration**
   - RESTful API for configuration and monitoring
   - Sends regular updates to the backend system
   - Ensures data consistency with error handling

## Technical Implementation Details

### Image Processing Pipeline
1. **Pre-processing**
   - Grayscale conversion
   - Gaussian blur (3x3 kernel)
   - Adaptive thresholding (block size 25, C=16)
   - Median blur for noise reduction
   - Dilation to connect nearby white pixels

2. **Space Analysis**
   - Region of Interest (ROI) extraction for each space
   - Non-zero pixel counting for occupancy detection
   - Threshold-based classification (default: 900 pixels)
   - Temporal averaging for stability

3. **Performance Optimization**
   - Adaptive frame skipping based on workload
   - Thread pooling for parallel processing
   - Non-blocking backend updates
   - Configurable update frequency

## API Endpoints

### Parking Lot Configuration
```
POST /config/parking-lot
```
Configures the ML service to process a parking lot video feed.

**Request Body**:
```json
{
  "lot_id": 1,
  "name": "Main Parking",
  "location": "Building A",
  "video_feed_url": "https://example.com/parking-feed.mp4",
  "parking_spots": [
    {"id": 101, "x": 100, "y": 200},
    {"id": 102, "x": 300, "y": 200}
  ]
}
```

### Stop Processing
```
DELETE /config/parking-lot/{lot_id}
```
Stops processing for a specific parking lot.

### Service Status
```
GET /status
```
Returns the status of all active processing jobs.

### Health Check
```
GET /health
```
Simple health check endpoint for monitoring.

### Test Single Image
```
POST /test/single-image
```
Tests processing on a single uploaded image.

## Integration with Backend

The ML service sends updates to the backend API every 15 seconds (configurable via `UPDATE_INTERVAL`). The updates include:
- Lot ID
- Timestamp
- List of parking spot detections with:
  - Spot ID
  - Occupancy status
  - Confidence level
  - License plate (if detected)

The backend endpoint for updates is configured via the `BACKEND_API_URL` environment variable.

## Configuration

### Environment Variables
Create a `.env` file with the following settings:

```
# Backend API
BACKEND_API_URL=http://localhost:8000/api

# Service configuration
PORT=8001
HOST=0.0.0.0

# Debug options
DEBUG=False
SAVE_DEBUG_IMAGES=True

# Processing configuration
UPDATE_INTERVAL=15  # Send updates to backend every 15 seconds
MAX_WORKERS=4       # Number of worker threads for parallel processing
```

## Setup and Installation

### Prerequisites
- Python 3.8+
- OpenCV
- FFmpeg (for video processing)

### Installation
1. Create and activate a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Create a `.env` file based on `.env.example`

4. Start the service:
   ```
   python main.py
   ```

## Troubleshooting

### Poor Detection Accuracy
- Adjust the `threshold_block_size` and `threshold_constant` parameters in `ProcessingParams` class
- Check lighting conditions in the video feed
- Verify parking space coordinates are correctly positioned

### Performance Issues
- Decrease the `UPDATE_INTERVAL` for less frequent updates
- Increase the value of `skip_frames` in the video processing loop
- Consider reducing video resolution

### Connection Problems
- Verify that the backend API is accessible
- Check the `BACKEND_API_URL` environment variable
- Ensure the backend has the `/api/parking-events/ml-update` endpoint
- Check network connectivity and firewall settings

## Integration with Admin Dashboard

The service is designed to be configured through the admin dashboard in the main application. The integration is handled through the following endpoints:

1. **Admin Dashboard -> ML Service**:
   - `POST /api/admin/parking-lots/ml-config` in backend forwards to `/config/parking-lot` in ML service
   - `DELETE /api/admin/parking-lots/{lot_id}/ml-config` in backend forwards to `/config/parking-lot/{lot_id}` in ML service
   - `GET /api/admin/ml-service/status` in backend forwards to `/status` in ML service

2. **ML Service -> Backend**:
   - Updates are sent to `/api/parking-events/ml-update` in backend
   
The admin dashboard allows users to:
- Configure video feeds for parking lots
- View the status of ML processing
- Start/stop ML processing for specific lots