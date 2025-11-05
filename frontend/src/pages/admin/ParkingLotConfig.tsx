import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CropFreeIcon from '@mui/icons-material/CropFree';
import SaveIcon from '@mui/icons-material/Save';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Steps in the configuration process
const steps = [
  'Enter Parking Lot Details',
  'Add YouTube Video',
  'Select Parking Spots', 
  'Process and Save'
];

interface ParkingSpot {
  id: number;
  x: number;
  y: number;
}

const ParkingLotConfig: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [lotName, setLotName] = useState('');
  const [lotLocation, setLotLocation] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedSpots, setSelectedSpots] = useState<ParkingSpot[]>([]);
  const [lotId, setLotId] = useState<number | null>(null);
  
  // Video player state
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasImage, setCanvasImage] = useState<string | null>(null);
  
  // Handle step navigation
  const handleNext = () => {
    if (activeStep === 0) {
      // Validate lot details
      if (!lotName || !lotLocation) {
        setError('Please fill in all parking lot details');
        return;
      }
      // Create the parking lot
      createParkingLot();
    } else if (activeStep === 1) {
      // Validate video URL
      if (!videoUrl) {
        setError('Please enter a YouTube video URL');
        return;
      }
      // Prepare video for processing
      setIsVideoReady(true);
    } else if (activeStep === 2) {
      // Validate selected spots
      if (selectedSpots.length === 0) {
        setError('Please select at least one parking spot');
        return;
      }
      // Prepare for final processing
      setActiveStep(prevStep => prevStep + 1);
    } else if (activeStep === 3) {
      // Save the configuration to the ML service
      saveParkingConfiguration();
    }
    
    if (activeStep < 3) {
      setActiveStep(prevStep => prevStep + 1);
    }
  };
  
  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };
  
  // Create a new parking lot
  const createParkingLot = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/admin/parking-lots', {
        name: lotName,
        location: lotLocation
      });
      
      setLotId(response.data.id);
      setSuccess(`Parking lot "${lotName}" created successfully`);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create parking lot');
      console.error('Error creating parking lot:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Configure video feed for ML processing
  const saveParkingConfiguration = async () => {
    if (!lotId) {
      setError('Missing parking lot ID');
      return;
    }
    
    try {
      setLoading(true);
      setIsProcessing(true);
      setError(null);
      
      // First update the video URL
      await axios.post('/api/admin/parking-lots/ml-config', {
        lot_id: lotId,
        video_feed_url: videoUrl
      });
      
      // Then configure the parking spots
      const spotsConfig = selectedSpots.map((spot, index) => ({
        id: index + 1, // Generate temporary IDs
        x: spot.x,
        y: spot.y
      }));
      
      // Create FormData for spots configuration
      const formData = new FormData();
      formData.append('lot_id', lotId.toString());
      formData.append('spots_data', JSON.stringify(spotsConfig));
      
      // Send the spot configuration
      await axios.post('/api/admin/parking-lots/spots-config', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSuccess('Parking lot configuration saved. ML processing has started.');
      setTimeout(() => {
        navigate('/admin');
      }, 3000);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save parking configuration');
      console.error('Error saving configuration:', err);
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };
  
  // Extract YouTube ID from URL
  const getYouTubeId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?]*)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };
  
  // Capture frame from video for spot selection
  const captureVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // This is a mock function since we can't actually capture frames from an iframe
    // In a real implementation, you'd use the YouTube API to control the video
    // and capture frames, or use a server-side approach
    
    // For now, we'll just show an alert and prepare a demo canvas
    alert('In a real implementation, this would capture the current video frame');
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw a demo parking lot image (gray background with white parking lines)
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw some parking lines
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    // Draw 10 parking spots in 2 rows
    for (let i = 0; i < 5; i++) {
      // Top row
      ctx.strokeRect(50 + i * 110, 50, 100, 40);
      // Bottom row
      ctx.strokeRect(50 + i * 110, 150, 100, 40);
    }
    
    setCanvasImage(canvas.toDataURL());
  };
  
  // Add a parking spot when canvas is clicked
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Add spot to the list
    const newSpot: ParkingSpot = {
      id: selectedSpots.length + 1,
      x: Math.round(x),
      y: Math.round(y)
    };
    
    setSelectedSpots([...selectedSpots, newSpot]);
    
    // Draw spot on canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.fillRect(x - 10, y - 10, 20, 20);
      ctx.strokeStyle = 'white';
      ctx.strokeRect(x - 10, y - 10, 20, 20);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(newSpot.id.toString(), x - 4, y + 4);
    }
  };
  
  // Remove the last added spot
  const removeLastSpot = () => {
    if (selectedSpots.length === 0) return;
    
    const newSpots = [...selectedSpots];
    newSpots.pop();
    setSelectedSpots(newSpots);
    
    // Redraw canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Clear canvas and redraw base image from scratch
        captureVideoFrame();
        
        // Redraw remaining spots
        setTimeout(() => {
          newSpots.forEach(spot => {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.fillRect(spot.x - 10, spot.y - 10, 20, 20);
            ctx.strokeStyle = 'white';
            ctx.strokeRect(spot.x - 10, spot.y - 10, 20, 20);
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(spot.id.toString(), spot.x - 4, spot.y + 4);
          });
        }, 100);
      }
    }
  };
  
  // Render current step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Enter Parking Lot Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Parking Lot Name"
                  variant="outlined"
                  fullWidth
                  value={lotName}
                  onChange={(e) => setLotName(e.target.value)}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Location"
                  variant="outlined"
                  fullWidth
                  value={lotLocation}
                  onChange={(e) => setLotLocation(e.target.value)}
                  placeholder="Address or coordinates"
                  required
                />
              </Grid>
            </Grid>
          </Box>
        );
        
      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Add YouTube Video
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="YouTube Video URL"
                  variant="outlined"
                  fullWidth
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Enter a YouTube URL of your parking lot footage. It can be a pre-recorded video or a live stream.
                </Typography>
              </Grid>
              
              {videoUrl && getYouTubeId(videoUrl) && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Video Preview
                    </Typography>
                    
                    <Box sx={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                      <iframe
                        ref={videoRef}
                        src={`https://www.youtube.com/embed/${getYouTubeId(videoUrl)}?enablejsapi=1`}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Parking Lot Video"
                      />
                    </Box>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        );
        
      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Parking Spots
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Click "Capture Frame" to take a snapshot of the video, then click on the image to mark parking spots.
                </Typography>
                
                <Box display="flex" gap={2} mb={2}>
                  <Button 
                    variant="contained" 
                    startIcon={<CropFreeIcon />}
                    onClick={captureVideoFrame}
                  >
                    Capture Frame
                  </Button>
                  
                  <Button 
                    variant="outlined"
                    color="error"
                    onClick={removeLastSpot}
                    disabled={selectedSpots.length === 0}
                  >
                    Remove Last Spot
                  </Button>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Box sx={{ position: 'relative' }}>
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={400}
                      onClick={handleCanvasClick}
                      style={{ border: '1px solid #ccc', cursor: 'crosshair', maxWidth: '100%' }}
                    />
                  </Box>
                  
                  <Box mt={2}>
                    <Typography variant="body2">
                      Selected Spots: <Chip label={selectedSpots.length} color="primary" size="small" />
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );
        
      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Process and Save
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Alert severity="info">
                  Once you click "Process & Save", the ML service will start analyzing the video feed to detect parking space occupancy.
                </Alert>
              </Grid>
              
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Configuration Summary
                  </Typography>
                  
                  <Box display="flex" flexDirection="column" gap={1} mb={2}>
                    <Typography variant="body2">
                      <strong>Parking Lot:</strong> {lotName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Location:</strong> {lotLocation}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Video Source:</strong> {videoUrl}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Selected Spots:</strong> {selectedSpots.length}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              
              {isProcessing && (
                <Grid item xs={12}>
                  <Box display="flex" alignItems="center" gap={2} p={2}>
                    <CircularProgress size={24} />
                    <Typography>
                      Configuring ML service and processing video feed...
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  // Draw initial canvas when the component mounts
  useEffect(() => {
    if (activeStep === 2 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('Click "Capture Frame" to start selecting parking spots', canvas.width / 2, canvas.height / 2);
      }
    }
  }, [activeStep]);
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <VideoLibraryIcon sx={{ mr: 1 }} />
          Configure Parking Lot with Video
        </Typography>
        
        <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 2 }}>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        <Box mb={4}>
          {renderStepContent()}
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <Box display="flex" justifyContent="space-between">
          <Button
            onClick={handleBack}
            disabled={activeStep === 0 || loading}
          >
            Back
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={loading}
            startIcon={activeStep === 3 ? <SaveIcon /> : activeStep === 2 ? <CropFreeIcon /> : <AddIcon />}
          >
            {activeStep === 3 ? 'Process & Save' : 'Next'}
            {loading && <CircularProgress size={24} sx={{ ml: 1 }} />}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ParkingLotConfig; 