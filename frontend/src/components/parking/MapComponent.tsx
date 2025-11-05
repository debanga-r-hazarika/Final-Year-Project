import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, CircleMarker } from 'react-leaflet';
import { Box, Typography, CircularProgress, Alert, Paper } from '@mui/material';
import { AppDispatch } from '../../store';
import { fetchParkingSpots, selectSpot } from '../../store/slices/parkingSlice';
import { RootState } from '../../store';
import Lottie from 'lottie-react';
import noResultsAnimation from '../../assets/animations/no-results.json';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  location?: string;
  center?: { lat: number; lng: number };
  selectedLotId?: number | null;
}

const containerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '8px'
};

// Use a default location (will be overridden by user location if available)
const defaultCenter = {
  lat: 51.5074,  // London
  lng: -0.1278
};

// Define custom icons with proper paths to icon images
const availableIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const occupiedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map updater component that handles map view changes and events
const MapUpdater = ({ center, zoomLevel, spotLocation }: { 
  center: { lat: number; lng: number },
  zoomLevel?: number,
  spotLocation?: { lat: number; lng: number } | null
}) => {
  const map = useMap();
  
  // Add map event handlers for debugging
  useEffect(() => {
    const onMove = () => {
      console.log('Map moved to:', map.getCenter());
    };
    
    const onZoom = () => {
      console.log('Map zoomed to level:', map.getZoom());
    };
    
    const onLocationFound = (e: any) => {
      console.log('Location found:', e.latlng);
    };
    
    const onLocationError = (e: any) => {
      console.error('Location error:', e.message);
    };

    map.on('move', onMove);
    map.on('zoom', onZoom);
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    return () => {
      map.off('move', onMove);
      map.off('zoom', onZoom);
      map.off('locationfound', onLocationFound);
      map.off('locationerror', onLocationError);
    };
  }, [map]);
  
  useEffect(() => {
    // If a specific spot location is provided, go there
    if (spotLocation) {
      console.log('Setting map view to spot location:', spotLocation);
      map.setView([spotLocation.lat, spotLocation.lng], zoomLevel || 18, {
        animate: true,
        duration: 1 // 1 second animation
      });
    } else {
      // Otherwise use the center
      console.log('Setting map view to center:', center);
      map.setView([center.lat, center.lng], zoomLevel || 14, {
        animate: true,
        duration: 1
      });
    }
  }, [center, map, spotLocation, zoomLevel]);
  
  return null;
};

// Custom car marker icon
const carIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const MapComponent: React.FC<MapComponentProps> = ({ location, center, selectedLotId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { spots, selectedSpot, isLoading, error } = useSelector((state: RootState) => state.parking);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(center || defaultCenter);
  const [noSpotsFound, setNoSpotsFound] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoaded, setLocationLoaded] = useState<boolean>(false);
  const [currentSpotLocation, setCurrentSpotLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Get user's location when component mounts
  useEffect(() => {
    if (navigator.geolocation && !locationLoaded) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('User location detected:', userPos);
          setUserLocation(userPos);
          setMapCenter(userPos); // Center map on user's location
          setLocationLoaded(true);
          
          // Add a local parking lot near the user's location
          addLocalParkingLot(userPos);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationLoaded(true); // Mark as loaded even on error
        },
        { 
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
  }, [locationLoaded]);
  
  // Function to add a local parking lot near the user's location
  const addLocalParkingLot = async (userPos: { lat: number; lng: number }) => {
    try {
      // Add small offsets to create a parking lot near the user
      const parkingLotPos = {
        lat: userPos.lat + 0.002, // Approximately 200m north
        lng: userPos.lng + 0.001  // Approximately 100m east
      };
      
      console.log('Adding local parking lot near:', parkingLotPos);
      
      // First, try to create a new parking lot
      const lotResponse = await fetch('/api/admin/parking-lots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: 'Local Parking',
          location: 'Near Current Location',
          total_spots: 5
        })
      });
      
      // Even if this fails (e.g., not admin), we'll still create local spots in the UI
      let lotId = 999; // Default lot ID if creation fails
      
      if (lotResponse.ok) {
        const lotData = await lotResponse.json();
        lotId = lotData.id;
      }
      
      // Create 5 parking spots in the area
      for (let i = 0; i < 5; i++) {
        // Create a pattern of spots
        const spotLat = parkingLotPos.lat + (i % 3) * 0.0001;
        const spotLng = parkingLotPos.lng + Math.floor(i / 3) * 0.0001;
        
        try {
          await fetch('/api/parking-spots', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              name: `Spot ${i+1}`,
              location: 'Near Current Location',
              spot_type: i === 0 ? 'handicapped' : 'regular',
              coordinates_x: spotLat,
              coordinates_y: spotLng,
              lot_id: lotId
            })
          });
        } catch (error) {
          console.error('Error creating local parking spot:', error);
        }
      }
      
      // Fetch updated spots
      dispatch(fetchParkingSpots());
      
    } catch (error) {
      console.error('Error creating local parking lot:', error);
    }
  };

  useEffect(() => {
    dispatch(fetchParkingSpots());
  }, [dispatch]);

  // Filter spots based on location or selected lot
  const filteredSpots = useMemo(() => {
    // Log all spots for debugging
    console.log('All spots:', spots);
    
    if (selectedLotId) {
      // Filter by lot ID if provided
      console.log(`Filtering by lot ID: ${selectedLotId}`);
      const filtered = spots.filter(spot => spot.lot_id === selectedLotId);
      console.log('Filtered spots by lot:', filtered);
      
      // If we have filtered spots by lot, center on the first one
      if (filtered.length > 0 && filtered[0].coordinates_x && filtered[0].coordinates_y) {
        const firstSpot = filtered[0];
        const spotPosition = {
          lat: firstSpot.coordinates_x,
          lng: firstSpot.coordinates_y
        };
        setCurrentSpotLocation(spotPosition);
      }
      
      setNoSpotsFound(filtered.length === 0);
      return filtered;
    } else if (location && location.trim() !== '') {
      // Alternatively filter by location name
      console.log(`Filtering by location name: ${location}`);
      const filtered = spots.filter(spot => 
        spot.location && 
        spot.location.toLowerCase().includes(location.toLowerCase())
      );
      console.log('Filtered spots by location:', filtered);
      
      setNoSpotsFound(filtered.length === 0);
      return filtered;
    }
    
    // No filtering
    setNoSpotsFound(spots.length === 0);
    return spots;
  }, [spots, location, selectedLotId]);

  const handleMarkerClick = (spot: any) => {
    console.log('Spot clicked:', spot);
    setSelectedMarker(spot.id);
    dispatch(selectSpot(spot));
    
    if (spot.coordinates_x && spot.coordinates_y) {
      setCurrentSpotLocation({
        lat: spot.coordinates_x,
        lng: spot.coordinates_y
      });
    }
  };

  // Function to get position for a spot
  const getSpotPosition = (spot: any) => {
    // If the spot has coordinates, use them
    if (spot.coordinates_x !== null && spot.coordinates_y !== null) {
      return {
        lat: spot.coordinates_x,
        lng: spot.coordinates_y
      };
    }
    
    // If no coordinates, generate a stable position based on spot ID
    // This ensures the position doesn't change on re-renders
    const stableSeed = spot.id * 10000; // Use the ID as a seed
    const pseudoRandom = Math.sin(stableSeed) * 10000;
    const offset = (pseudoRandom % 100) / 5000; // Small stable offset
    
    return {
      lat: mapCenter.lat + offset,
      lng: mapCenter.lng + (offset * 1.5) // Different offset for longitude
    };
  };

  // Initialize the map reference
  const MapContainerRef = () => {
    const map = useMap();
    
    useEffect(() => {
      if (map) {
        mapRef.current = map;
        map.locate({setView: false});
        
        // Log the map bounds for debugging
        console.log('Map bounds:', map.getBounds());
      }
    }, [map]);
    
    return null;
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '500px' }}>
        <CircularProgress color="primary" />
        <Typography sx={{ ml: 2 }}>Loading parking spots...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      </Box>
    );
  }

  if (noSpotsFound) {
    return (
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center', minHeight: '500px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <Box sx={{ width: '200px', height: '200px', mb: 2 }}>
          <Lottie animationData={noResultsAnimation} loop={true} />
        </Box>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No parking spots found
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {location ? `No parking spots found in "${location}". Try a different location.` : 'No parking spots available.'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '500px', position: 'relative' }}>
      {/* Map debugging info */}
      <Box sx={{ position: 'absolute', top: 5, right: 5, zIndex: 1000, backgroundColor: 'rgba(255,255,255,0.8)', p: 1, borderRadius: 1, fontSize: '0.75rem' }}>
        <Typography variant="caption" display="block">
          Spots: {filteredSpots.length} | User location: {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'Unknown'}
        </Typography>
      </Box>
      
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={14}
        style={containerStyle}
        zoomControl={false}
      >
        <MapContainerRef />
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapUpdater 
          center={mapCenter} 
          spotLocation={currentSpotLocation}
          zoomLevel={currentSpotLocation ? 18 : 14}
        />
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={carIcon}
          >
            <Popup>
              <Typography variant="body2">You are here</Typography>
            </Popup>
          </Marker>
        )}
        
        {/* Render spots with CircleMarker for better visibility */}
        {filteredSpots.map((spot) => {
          const position = getSpotPosition(spot);
          
          return (
            <React.Fragment key={spot.id}>
              {/* Regular marker */}
              <Marker
                position={[position.lat, position.lng]}
                icon={spot.is_available ? availableIcon : occupiedIcon}
                eventHandlers={{
                  click: () => handleMarkerClick(spot)
                }}
              >
                {selectedMarker === spot.id && (
                  <Popup>
                    <Box sx={{ p: 1, maxWidth: '200px' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {spot.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: spot.is_available ? 'green' : 'red' }}>
                        {spot.is_available ? 'Available' : 'Occupied'}
                      </Typography>
                      {spot.location && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {spot.location}
                        </Typography>
                      )}
                    </Box>
                  </Popup>
                )}
              </Marker>
              
              {/* Circle marker for better visibility */}
              <CircleMarker 
                center={[position.lat, position.lng]}
                radius={10}
                pathOptions={{
                  fillColor: spot.is_available ? '#00c853' : '#d50000',
                  fillOpacity: 0.5,
                  weight: 1,
                  color: spot.is_available ? '#00c853' : '#d50000'
                }}
                eventHandlers={{
                  click: () => handleMarkerClick(spot)
                }}
              />
            </React.Fragment>
          );
        })}
      </MapContainer>
    </Box>
  );
};

export default MapComponent;