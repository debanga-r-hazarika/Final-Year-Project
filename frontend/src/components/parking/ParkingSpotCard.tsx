import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Box,
  Tooltip,
  CircularProgress
} from '@mui/material';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VideoLabelIcon from '@mui/icons-material/VideoLabel';
import { useNavigate } from 'react-router-dom';

// Define the types for the component props
interface ParkingSpotCardProps {
  id: number;
  name: string;
  lotName: string;
  isAvailable: boolean;
  spotType: string;
  mlStatus: string | null;
  lastMlUpdate: string | null;
  hasActiveReservation: boolean;
  hasActiveEvent: boolean;
  licensePlate: string | null;
  onReserveClick?: () => void;
}

// Helper function to format time difference
const getTimeSinceUpdate = (lastUpdateTime: string): string => {
  if (!lastUpdateTime) return 'Never updated';
  
  const lastUpdate = new Date(lastUpdateTime);
  const now = new Date();
  const diffMs = now.getTime() - lastUpdate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
};

const ParkingSpotCard: React.FC<ParkingSpotCardProps> = ({
  id,
  name,
  lotName,
  isAvailable,
  spotType,
  mlStatus,
  lastMlUpdate,
  hasActiveReservation,
  hasActiveEvent,
  licensePlate,
  onReserveClick
}) => {
  const navigate = useNavigate();
  
  const viewDetails = () => {
    navigate(`/parking-spots/${id}`);
  };
  
  // Determine status text and color
  let statusColor = 'default';
  let statusText = 'Unknown';
  
  if (hasActiveReservation) {
    statusColor = 'secondary';
    statusText = 'Reserved';
  } else if (hasActiveEvent) {
    statusColor = 'error';
    statusText = 'Occupied';
  } else if (isAvailable) {
    statusColor = 'success';
    statusText = 'Available';
  } else {
    statusColor = 'error';
    statusText = 'Unavailable';
  }
  
  // Render ML status info if available
  const renderMlStatus = () => {
    if (!mlStatus) return null;
    
    const mlStatusLabel = mlStatus === 'occupied' ? 'Occupied' : 'Empty';
    const mlStatusColor = mlStatus === 'occupied' ? 'error' : 'success';
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        <VideoLabelIcon fontSize="small" sx={{ mr: 1 }} />
        <Tooltip title={`ML detection: ${mlStatusLabel}`}>
          <Chip 
            label={`ML: ${mlStatusLabel}`}
            color={mlStatusColor as any}
            size="small"
            sx={{ mr: 1 }}
          />
        </Tooltip>
        {lastMlUpdate && (
          <Tooltip title={`Last updated: ${new Date(lastMlUpdate).toLocaleString()}`}>
            <Typography variant="caption" color="text.secondary">
              <AccessTimeIcon fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              {getTimeSinceUpdate(lastMlUpdate)}
            </Typography>
          </Tooltip>
        )}
      </Box>
    );
  };
  
  return (
    <Card 
      sx={{ 
        mb: 2,
        border: 2,
        borderColor: `${statusColor}.main`,
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'scale(1.02)',
          boxShadow: 3
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
              <LocalParkingIcon sx={{ mr: 1 }} />
              {name}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {lotName}
            </Typography>
          </Box>
          <Chip 
            label={statusText}
            color={statusColor as any}
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
        
        <Box sx={{ mt: 2 }}>
          <Chip 
            label={spotType || 'Standard'}
            variant="outlined"
            size="small"
            sx={{ mr: 1 }}
          />
          
          {hasActiveEvent && licensePlate && (
            <Chip 
              label={`License: ${licensePlate}`}
              variant="outlined"
              size="small"
            />
          )}
        </Box>
        
        {renderMlStatus()}
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            variant="outlined" 
            size="small"
            onClick={viewDetails}
          >
            View Details
          </Button>
          
          {isAvailable && !hasActiveReservation && (
            <Button 
              variant="contained" 
              color="primary"
              size="small"
              onClick={onReserveClick}
              disabled={!isAvailable}
            >
              Reserve
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ParkingSpotCard; 