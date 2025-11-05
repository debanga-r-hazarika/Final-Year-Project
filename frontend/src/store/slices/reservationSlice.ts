import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import axios from 'axios';

// Define types
interface Reservation {
  id: number;
  user_id: number;
  spot_id: number;
  vehicle_id: number | null;
  start_time: string;
  end_time: string;
  status: string;
}

interface ReservationState {
  reservations: Reservation[];
  selectedReservation: Reservation | null;
  isLoading: boolean;
  error: string | null;
}

interface CreateReservationData {
  spot_id: number;
  start_time: string;
  end_time: string;
  vehicle_id?: number;
}

// Define initial state
const initialState: ReservationState = {
  reservations: [],
  selectedReservation: null,
  isLoading: false,
  error: null,
};

// API base URL
const API_URL = 'http://localhost:8000/api';

// Async thunks
export const fetchUserReservations = createAsyncThunk(
  'reservation/fetchUserReservations',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      
      if (!token) {
        return rejectWithValue('No token found');
      }
      
      const response = await axios.get(`${API_URL}/reservations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch reservations');
    }
  }
);

export const createReservation = createAsyncThunk(
  'reservation/createReservation',
  async (reservationData: CreateReservationData, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      
      if (!token) {
        return rejectWithValue('No token found');
      }
      
      const response = await axios.post(`${API_URL}/reservations`, reservationData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create reservation');
    }
  }
);

export const cancelReservation = createAsyncThunk(
  'reservation/cancelReservation',
  async (reservationId: number, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const token = state.auth.token;
      
      if (!token) {
        return rejectWithValue('No token found');
      }
      
      const response = await axios.patch(
        `${API_URL}/reservations/${reservationId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to cancel reservation');
    }
  }
);

// Create slice
const reservationSlice = createSlice({
  name: 'reservation',
  initialState,
  reducers: {
    selectReservation: (state, action: PayloadAction<Reservation>) => {
      state.selectedReservation = action.payload;
    },
    clearSelectedReservation: (state) => {
      state.selectedReservation = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch user reservations
    builder.addCase(fetchUserReservations.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchUserReservations.fulfilled, (state, action: PayloadAction<Reservation[]>) => {
      state.isLoading = false;
      state.reservations = action.payload;
    });
    builder.addCase(fetchUserReservations.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Create reservation
    builder.addCase(createReservation.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(createReservation.fulfilled, (state, action: PayloadAction<Reservation>) => {
      state.isLoading = false;
      state.reservations.push(action.payload);
    });
    builder.addCase(createReservation.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Cancel reservation
    builder.addCase(cancelReservation.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(cancelReservation.fulfilled, (state, action: PayloadAction<Reservation>) => {
      state.isLoading = false;
      const index = state.reservations.findIndex(res => res.id === action.payload.id);
      if (index !== -1) {
        state.reservations[index] = action.payload;
      }
    });
    builder.addCase(cancelReservation.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

// Export actions
export const { selectReservation, clearSelectedReservation, clearError } = reservationSlice.actions;

// Export selectors
export const selectReservations = (state: RootState) => state.reservation.reservations;
export const selectSelectedReservation = (state: RootState) => state.reservation.selectedReservation;
export const selectReservationLoading = (state: RootState) => state.reservation.isLoading;
export const selectReservationError = (state: RootState) => state.reservation.error;

export default reservationSlice.reducer;