import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  Box,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DashboardIcon from '@mui/icons-material/Dashboard';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AutorenewIcon from '@mui/icons-material/Autorenew';

interface ParkingLot {
  id: number;
  name: string;
  location: string;
  spots_count?: number;
  ml_processing?: boolean;
  video_feed_url?: string;
}

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [mlServiceStatus, setMlServiceStatus] = useState<any>(null);
  const [mlServiceError, setMlServiceError] = useState<string | null>(null);
  
  // Fetch parking lots
  useEffect(() => {
    const fetchParkingLots = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching parking lots...');
        
        // Get auth token from localStorage
        const token = localStorage.getItem('token');
        
        // Configure request with proper headers and base URL
        const response = await axios({
          method: 'get',
          url: '/api/admin/parking-lots',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          // Make sure any redirects return JSON and not HTML
          validateStatus: (status) => status < 500,
        });
        
        console.log('API response status:', response.status);
        console.log('API response headers:', response.headers);
        console.log('API response data type:', typeof response.data);
        console.log('API response data:', response.data);
        
        // Check the content type to ensure we're getting JSON
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('text/html')) {
          console.error('Received HTML instead of JSON. Likely authentication issue.');
          setParkingLots([]);
          setError('Authentication issue detected. Please try logging out and logging back in.');
          return;
        }
        
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          console.error('Authentication error:', response.status);
          setParkingLots([]);
          setError('You do not have permission to access this resource. Please log in as an admin user.');
          return;
        }
        
        // Make sure the response data is an array before setting it
        if (Array.isArray(response.data)) {
          console.log('Valid array data received:', response.data);
          setParkingLots(response.data);
        } else {
          console.error('API returned non-array data:', response.data);
          setParkingLots([]); // Set to empty array as fallback
          setError('Received invalid data format from server. Expected an array of parking lots.');
        }
        
      } catch (err: any) {
        console.error('Error fetching parking lots:', err);
        setParkingLots([]); // Ensure parkingLots is always an array
        if (err.response?.status === 403) {
          setError('You do not have permission to access the admin dashboard. Please contact an administrator.');
        } else {
          setError(err.response?.data?.detail || 'Failed to fetch parking lots. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchParkingLots();
  }, []);
  
  // Check ML service status
  const checkMlServiceStatus = async () => {
    try {
      setMlServiceError(null);
      
      console.log('Checking ML service health...');
      
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      
      // Configure request with proper headers
      const response = await axios({
        method: 'get',
        url: '/api/admin/ml-service/health',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        // Set a shorter timeout since this is a health check
        timeout: 5000,
        validateStatus: (status) => true, // Accept any status to handle in our code
      });
      
      console.log('ML service health response:', response);
      
      // Handle different response scenarios
      if (response.status >= 400) {
        console.error('ML service health check error:', response.status);
        setMlServiceStatus({ status: 'unreachable', message: `Error checking ML service: ${response.status}` });
      } else {
        setMlServiceStatus(response.data);
      }
      
    } catch (err: any) {
      console.error('Error checking ML service:', err);
      // Set a specific status for network errors
      setMlServiceStatus({ 
        status: 'unreachable', 
        message: 'Cannot connect to ML service' 
      });
      
      if (err.response?.status === 403) {
        setMlServiceError('You do not have permission to check ML service status.');
      } else {
        setMlServiceError(err.message || 'Failed to check ML service status.');
      }
    }
  };
  
  useEffect(() => {
    checkMlServiceStatus();
    
    // Poll status every 30 seconds
    const intervalId = setInterval(checkMlServiceStatus, 30000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Navigate to add new parking lot page
  const handleAddParkingLot = () => {
    navigate('/admin/parking-lots/new');
  };
  
  // Start ML processing for a parking lot
  const startMlProcessing = async (lotId: number) => {
    try {
      // Get the parking lot details first to get its video feed URL
      const lotResponse = await axios.get(`/api/admin/parking-lots/${lotId}`);
      const lot = lotResponse.data;
      
      if (!lot.video_feed_url) {
        alert("This parking lot doesn't have a video feed URL configured. Please edit the lot first.");
        return;
      }
      
      // Configure ML processing by posting to the ml-config endpoint
      await axios.post('/api/admin/parking-lots/ml-config', {
        lot_id: lotId,
        video_feed_url: lot.video_feed_url
      });
      
      // Refresh lot list
      const response = await axios.get('/api/admin/parking-lots');
      setParkingLots(response.data);
      
    } catch (err) {
      console.error('Error starting ML processing:', err);
      alert('Failed to start ML processing. Please check if the ML service is running.');
    }
  };
  
  // Stop ML processing for a parking lot
  const stopMlProcessing = async (lotId: number) => {
    try {
      await axios.delete(`/api/admin/parking-lots/${lotId}/ml-config`);
      
      // Refresh lot list
      const response = await axios.get('/api/admin/parking-lots');
      setParkingLots(response.data);
      
    } catch (err) {
      console.error('Error stopping ML processing:', err);
    }
  };
  
  // Delete a parking lot
  const deleteParkingLot = async (lotId: number) => {
    if (!window.confirm('Are you sure you want to delete this parking lot?')) {
      return;
    }
    
    try {
      await axios.delete(`/api/admin/parking-lots/${lotId}`);
      
      // Refresh lot list
      const response = await axios.get('/api/admin/parking-lots');
      setParkingLots(response.data);
      
    } catch (err) {
      console.error('Error deleting parking lot:', err);
    }
  };
  
  // View parking lot details
  const viewLotDetails = (lotId: number) => {
    navigate(`/parking-lots/${lotId}`);
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Dashboard Header */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <DashboardIcon sx={{ mr: 1 }} />
              Admin Dashboard
            </Typography>
            
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddParkingLot}
            >
              Add Parking Lot
            </Button>
          </Paper>
        </Grid>
        
        {/* ML Service Status */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 0 }}>
                <VideoLibraryIcon sx={{ mr: 1 }} />
                ML Service Status
              </Typography>
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutorenewIcon />}
                onClick={() => {
                  console.log("Manually checking ML service health...");
                  checkMlServiceStatus();
                }}
              >
                Check Status
              </Button>
            </Box>
            
            {mlServiceError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {mlServiceError}
              </Alert>
            ) : !mlServiceStatus ? (
              <Box display="flex" alignItems="center" mt={2}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography>Checking ML service status...</Typography>
              </Box>
            ) : (
              <Box mt={2}>
                <Chip
                  label={
                    mlServiceStatus.status === 'healthy' 
                      ? 'ML Service Online' 
                      : mlServiceStatus.status === 'unhealthy'
                        ? 'ML Service Unhealthy'
                        : 'ML Service Offline'
                  }
                  color={
                    mlServiceStatus.status === 'healthy' 
                      ? 'success' 
                      : mlServiceStatus.status === 'unhealthy'
                        ? 'warning'
                        : 'error'
                  }
                  sx={{ fontWeight: 'bold' }}
                />
                
                <Typography variant="body2" color="text.secondary" mt={1}>
                  {mlServiceStatus.message}
                </Typography>
                
                {mlServiceStatus.status !== 'healthy' && (
                  <Box mt={2}>
                    <Typography variant="body2" gutterBottom>
                      <strong>Troubleshooting:</strong>
                    </Typography>
                    <ul style={{ marginTop: 0, paddingLeft: '1.5rem' }}>
                      <li>Make sure the ML service is running on port 8001</li>
                      <li>Check the ML service logs for errors</li>
                      <li>Verify the ML_SERVICE_URL environment variable in your backend .env file</li>
                    </ul>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => window.open('http://localhost:8001/docs', '_blank')}
                      sx={{ mt: 1 }}
                    >
                      Open ML Service Docs
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Parking Lots List */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Managed Parking Lots
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : parkingLots.length === 0 ? (
              <Alert severity="info">
                No parking lots have been added yet. Click "Add Parking Lot" to create one.
              </Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Spots</TableCell>
                      <TableCell>ML Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(parkingLots) && parkingLots.length > 0 ? (
                      parkingLots.map((lot) => (
                        <TableRow key={lot.id}>
                          <TableCell>{lot.name}</TableCell>
                          <TableCell>{lot.location}</TableCell>
                          <TableCell>
                            {lot.spots_count || 0}
                          </TableCell>
                          <TableCell>
                            {lot.ml_processing ? (
                              <Chip
                                size="small"
                                label="ML Active"
                                color="success"
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="ML Inactive"
                                color="default"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Box display="flex">
                              <Tooltip title="View Lot">
                                <IconButton onClick={() => viewLotDetails(lot.id)} size="small">
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              
                              {lot.ml_processing ? (
                                <Tooltip title="Stop ML Processing">
                                  <IconButton 
                                    onClick={() => stopMlProcessing(lot.id)} 
                                    size="small"
                                    color="error"
                                  >
                                    <StopCircleIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title="Start ML Processing">
                                  <IconButton 
                                    onClick={() => startMlProcessing(lot.id)} 
                                    size="small"
                                    color="success"
                                  >
                                    <PlayCircleOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              
                              <Tooltip title="Delete Lot">
                                <IconButton 
                                  onClick={() => deleteParkingLot(lot.id)}
                                  size="small"
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No parking lots found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default AdminDashboardPage; 