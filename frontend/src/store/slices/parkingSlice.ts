import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import axios from 'axios';
import api from '../../services/apiService';

// Define types
interface ParkingSpot {
  id: number;
  name: string;
  location: string;
  is_available: boolean;
  spot_type: string;
  coordinates_x: number;
  coordinates_y: number;
  ml_status?: string;
  last_ml_update?: string;
  lot_id?: number;
  video_feed_url?: string;
  has_active_reservation?: boolean;
  has_active_event?: boolean;
  license_plate?: string;
}

interface ParkingState {
  spots: ParkingSpot[];
  selectedSpot: ParkingSpot | null;
  isLoading: boolean;
  error: string | null;
}

// Define initial state
const initialState: ParkingState = {
  spots: [],
  selectedSpot: null,
  isLoading: false,
  error: null,
};

// API base URL
const API_URL = 'http://localhost:8000/api';

// Async thunks
export const fetchParkingSpots = createAsyncThunk(
  'parking/fetchSpots',
  async (_, { rejectWithValue }) => {
    try {
      // Use our API service with auth token
      const response = await api.get('/parking-spots');
      console.log('Fetched parking spots:', response.data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch parking spots');
    }
  }
);

export const fetchParkingSpotById = createAsyncThunk(
  'parking/fetchSpotById',
  async (spotId: number, { rejectWithValue }) => {
    try {
      const response = await api.get(`/parking-spots/${spotId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch parking spot');
    }
  }
);

// Create slice
const parkingSlice = createSlice({
  name: 'parking',
  initialState,
  reducers: {
    selectSpot: (state, action: PayloadAction<ParkingSpot>) => {
      state.selectedSpot = action.payload;
    },
    clearSelectedSpot: (state) => {
      state.selectedSpot = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    // Add a new reducer for real-time updates from WebSocket
    updateParkingSpots: (state, action: PayloadAction<ParkingSpot[]>) => {
      state.spots = action.payload;
      
      // If there's a selected spot, update it with the latest data
      if (state.selectedSpot) {
        const updatedSelectedSpot = action.payload.find(spot => spot.id === state.selectedSpot?.id);
        if (updatedSelectedSpot) {
          state.selectedSpot = updatedSelectedSpot;
        }
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch all parking spots
    builder.addCase(fetchParkingSpots.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchParkingSpots.fulfilled, (state, action: PayloadAction<ParkingSpot[]>) => {
      state.isLoading = false;
      state.spots = action.payload;
    });
    builder.addCase(fetchParkingSpots.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Fetch parking spot by ID
    builder.addCase(fetchParkingSpotById.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchParkingSpotById.fulfilled, (state, action: PayloadAction<ParkingSpot>) => {
      state.isLoading = false;
      state.selectedSpot = action.payload;
    });
    builder.addCase(fetchParkingSpotById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

// Export actions
export const { selectSpot, clearSelectedSpot, clearError, updateParkingSpots } = parkingSlice.actions;

// Export selectors
export const selectParkingSpots = (state: RootState) => state.parking.spots;
export const selectSelectedSpot = (state: RootState) => state.parking.selectedSpot;
export const selectParkingLoading = (state: RootState) => state.parking.isLoading;
export const selectParkingError = (state: RootState) => state.parking.error;

export default parkingSlice.reducer;