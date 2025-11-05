import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  Container, Box, Typography, Paper, Grid, Button, Chip, 
  TextField, InputAdornment, IconButton, Card, CardMedia,
  FormControl, InputLabel, Select, MenuItem, SelectChangeEvent,
  Alert
} from '@mui/material';
import { Link } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { RootState } from '../../store';
import MapComponent from '../../components/parking/MapComponent';
import { fetchParkingSpots } from '../../store/slices/parkingSlice';
import { AppDispatch } from '../../store';
import api from '../../services/apiService';

// Interface for parking lots
interface ParkingLot {
  id: number;
  name: string;
  location: string;
  total_spots: number;
}

const ParkingMapPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const selectedSpot = useSelector((state: RootState) => state.parking.selectedSpot);
  const [location, setLocation] = useState('');
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch all parking spots when the component mounts
  useEffect(() => {
    dispatch(fetchParkingSpots());
    fetchParkingLots();
  }, [dispatch]);

  // Fetch parking lots from the backend
  const fetchParkingLots = async () => {
    setLoading(true);
    try {
      const response = await api.get('/parking-lots');
      console.log('Fetched parking lots:', response.data);
      setParkingLots(response.data || []);
    } catch (error) {
      console.error('Error fetching parking lots:', error);
      setErrorMessage('Could not load parking lots. Using default data.');
      // Use some fallback data in case API fails
      setParkingLots([
        { id: 1, name: "University Campus Parking", location: "University Campus", total_spots: 6 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLotChange = (event: SelectChangeEvent<string | number>) => {
    const lotId = event.target.value as number;
    setSelectedLotId(lotId);
    // When a lot is selected, clear the text search location
    setLocation('');
    // Fetch the latest data
    dispatch(fetchParkingSpots());
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocation(e.target.value);
    // Clear the selected lot when typing a location
    if (e.target.value) {
      setSelectedLotId(null);
    }
  };

  const handleLocationSearch = () => {
    // Clear any messages
    setErrorMessage(null);
    setSuccessMessage(null);
    
    // Just fetch all spots, filtering will be done in the component
    dispatch(fetchParkingSpots());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLocationSearch();
    }
  };
  
  // Function to clean up all parking spots (admin only)
  const handleClearParkingSpots = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      // Get all spots first
      const response = await api.get('/parking-spots');
      const spots = response.data || [];
      
      if (spots.length === 0) {
        setSuccessMessage('No parking spots to clear');
        return;
      }
      
      // Delete each spot (this will only work if the user is an admin)
      let deletedCount = 0;
      for (const spot of spots) {
        try {
          await api.delete(`/admin/parking-spots/${spot.id}`);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete spot ${spot.id}:`, error);
        }
      }
      
      if (deletedCount > 0) {
        setSuccessMessage(`Successfully cleared ${deletedCount} parking spots`);
        // Refresh the data
        dispatch(fetchParkingSpots());
        fetchParkingLots();
      } else {
        setErrorMessage('Could not clear parking spots. Admin privileges required.');
      }
    } catch (error) {
      console.error('Error clearing parking spots:', error);
      setErrorMessage('Failed to clear parking spots. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Parking Map
        </Typography>
        
        <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              View and select available parking spots in real-time. Click on any spot to see details and make reservations.
            </Typography>
            
            <Button 
              variant="outlined" 
              color="error" 
              startIcon={<DeleteIcon />}
              onClick={handleClearParkingSpots}
              disabled={loading}
            >
              Clear Spots
            </Button>
          </Box>
          
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}
          
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            <FormControl fullWidth sx={{ flex: 1 }}>
              <InputLabel id="parking-lot-label">Select Parking Lot</InputLabel>
              <Select
                labelId="parking-lot-label"
                value={selectedLotId || ''}
                onChange={handleLotChange}
                label="Select Parking Lot"
                displayEmpty
                endAdornment={
                  <IconButton
                    size="small"
                    onClick={() => fetchParkingLots()}
                    sx={{ mr: 2 }}
                    title="Refresh parking lots"
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                }
              >
                <MenuItem value="">
                  <em>All Parking Lots</em>
                </MenuItem>
                {parkingLots.map(lot => (
                  <MenuItem key={lot.id} value={lot.id}>
                    {lot.name} - {lot.location}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
              OR
            </Typography>
            
            <TextField
              fullWidth
              label="Search by location"
              variant="outlined"
              value={location}
              onChange={handleLocationChange}
              onKeyPress={handleKeyPress}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleLocationSearch} edge="end">
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              placeholder="Enter location (e.g., University Campus)"
              sx={{ flex: 1 }}
            />
          </Box>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <MapComponent 
              location={location} 
              selectedLotId={selectedLotId}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mb: 2 }}>
                Spot Information
              </Typography>
              
              {selectedSpot ? (
                <Box>
                  <Typography variant="body1" gutterBottom>
                    <strong>Spot Number:</strong> {selectedSpot.name}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Status:</strong> 
                    <Chip 
                      size="small" 
                      label={selectedSpot.ml_status || (selectedSpot.is_available ? 'Available' : 'Occupied')} 
                      color={selectedSpot.ml_status === 'empty' ? 'success' : selectedSpot.ml_status === 'occupied' ? 'error' : selectedSpot.is_available ? 'success' : 'error'}
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Type:</strong> {selectedSpot.spot_type}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Location:</strong> {selectedSpot.location || 'Not specified'}
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    <strong>Coordinates:</strong> {selectedSpot.coordinates_x?.toFixed(6)}, {selectedSpot.coordinates_y?.toFixed(6)}
                  </Typography>
                  {selectedSpot.video_feed_url && (
                    <Card sx={{ mt: 2, mb: 2 }}>
                      <CardMedia
                        component="img"
                        height="200"
                        image={selectedSpot.video_feed_url}
                        alt="Live Feed"
                        sx={{ objectFit: 'cover' }}
                      />
                      <Typography variant="caption" color="text.secondary" align="center" sx={{ p: 1 }}>
                        Live Feed - Last Updated: {selectedSpot.last_ml_update ? new Date(selectedSpot.last_ml_update).toLocaleString() : 'Not available'}
                      </Typography>
                    </Card>
                  )}
                  
                  {selectedSpot.is_available && (
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      sx={{ mt: 3, py: 1.5 }}
                      component={Link}
                      to={`/reservations/new?spotId=${selectedSpot.id}`}
                    >
                      Reserve This Spot
                    </Button>
                  )}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary" align="center">
                    Select a parking spot on the map to view its details and availability.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default ParkingMapPage;