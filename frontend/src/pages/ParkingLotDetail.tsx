import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Button,
  Chip,
  Tooltip,
  Divider
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import VideoLabelIcon from '@mui/icons-material/VideoLabel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

import { getBackendWebSocket } from '../services/websocketService';
import { RootState, AppDispatch } from '../store';
import MapComponent from '../components/parking/MapComponent';

const ParkingLotDetail: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lotDetails, setLotDetails] = useState<any>(null);
  const [spots, setSpots] = useState<any[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  
  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const webSocket = getBackendWebSocket(dispatch);
    
    if (!webSocket.isConnected()) {
      webSocket.connect();
    }
    
    // Manual WebSocket message handling since we can't directly add event listeners
    const checkForUpdates = () => {
      // This will be handled by the existing WebSocket service's message handler
      // which updates Redux, and we'll rely on polling our state instead
    };
    
    // Set up polling for updates
    const intervalId = setInterval(() => {
      if (lotId) {
        // Manually fetch updates instead
        axios.get(`/api/parking-spots?lot_id=${lotId}`)
          .then(response => {
            setSpots(response.data);
            setLastUpdateTime(new Date());
          })
          .catch(err => console.error('Error polling spots:', err));
      }
    }, 5000); // Poll every 5 seconds
    
    return () => {
      clearInterval(intervalId);
    };
  }, [dispatch, lotId]);
  
  // Fetch lot details
  useEffect(() => {
    const fetchLotDetails = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/parking-lots/${lotId}`);
        setLotDetails(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to load parking lot details');
        console.error('Error fetching parking lot:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (lotId) {
      fetchLotDetails();
    }
  }, [lotId]);
  
  // Fetch spots for this lot
  useEffect(() => {
    const fetchParkingSpots = async () => {
      try {
        const response = await axios.get(`/api/parking-spots?lot_id=${lotId}`);
        setSpots(response.data);
        setLastUpdateTime(new Date());
      } catch (err) {
        console.error('Error fetching parking spots:', err);
      }
    };
    
    if (lotId) {
      fetchParkingSpots();
    }
  }, [lotId]);
  
  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/parking-spots?lot_id=${lotId}`);
      setSpots(response.data);
      setLastUpdateTime(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to refresh parking data');
      console.error('Error refreshing data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle reservation click
  const handleReserveClick = (spotId: number) => {
    navigate(`/reservations/new?spotId=${spotId}`);
  };
  
  if (loading && !lotDetails) {
    return (
      <Container sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }
  
  // Calculate availability statistics
  const totalSpots = spots.length;
  const availableSpots = spots.filter(spot => spot.is_available).length;
  const occupiedByML = spots.filter(spot => spot.ml_status === 'occupied').length;
  const availabilityPercentage = totalSpots > 0 ? Math.round((availableSpots / totalSpots) * 100) : 0;
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <MapIcon sx={{ mr: 1 }} />
              {lotDetails?.name || 'Parking Lot'}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {lotDetails?.location || 'Location not specified'}
            </Typography>
          </Box>
          
          <Button
            startIcon={<RefreshIcon />}
            variant="outlined"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
          <Chip 
            label={`Total spots: ${totalSpots}`}
            variant="outlined"
          />
          <Chip 
            label={`Available: ${availableSpots} (${availabilityPercentage}%)`}
            color="success"
          />
          <Chip 
            label={`Occupied: ${totalSpots - availableSpots}`}
            color="error"
          />
          <Tooltip title="Spots detected as occupied by ML service">
            <Chip 
              icon={<VideoLabelIcon />}
              label={`ML detected: ${occupiedByML}`}
              variant="outlined"
              color="info"
            />
          </Tooltip>
        </Box>
        
        {lastUpdateTime && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <AccessTimeIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
            Last updated: {lastUpdateTime.toLocaleString()}
          </Typography>
        )}
      </Paper>
      
      {/* Display parking lot map with spots */}
      <Paper sx={{ p: 3, mb: 3, height: 500 }}>
        <Typography variant="h6" gutterBottom>
          Parking Lot Map
        </Typography>
        
        {lotDetails && spots.length > 0 ? (
          <MapComponent
            location={lotDetails.location}
            center={lotDetails.coordinates ? { 
              lat: parseFloat(lotDetails.coordinates.split(',')[0]), 
              lng: parseFloat(lotDetails.coordinates.split(',')[1]) 
            } : undefined}
            selectedLotId={parseInt(lotId || '0')}
          />
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <Alert severity="info">
              No parking lot map available or no spots configured.
            </Alert>
          </Box>
        )}
      </Paper>
      
      {/* Display spot list */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Available Parking Spots
        </Typography>
        
        <Grid container spacing={3}>
          {spots.length > 0 ? (
            spots.map(spot => (
              <Grid item xs={12} sm={6} md={4} key={spot.id}>
                <Paper 
                  sx={{ 
                    p: 2, 
                    border: '1px solid',
                    borderColor: spot.is_available ? 'success.main' : 'error.main',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleReserveClick(spot.id)}
                >
                  <Typography variant="subtitle1">
                    {spot.name}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Chip
                      size="small"
                      label={spot.is_available ? 'Available' : 'Occupied'}
                      color={spot.is_available ? 'success' : 'error'}
                    />
                    {spot.ml_status && (
                      <Chip
                        size="small"
                        icon={<VideoLabelIcon />}
                        label={`ML: ${spot.ml_status}`}
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Paper>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Alert severity="info">
                No parking spots available for this lot.
              </Alert>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Container>
  );
};

export default ParkingLotDetail; 