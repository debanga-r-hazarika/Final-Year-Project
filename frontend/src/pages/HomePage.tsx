import React from 'react';
import { Typography, Button, Box, Grid, Paper, Container } from '@mui/material';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/slices/authSlice';

const HomePage: React.FC = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Welcome to the Parking Management System
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Find, reserve, and manage parking spots with ease
        </Typography>
        
        <Box sx={{ mt: 4, mb: 6 }}>
          {!isAuthenticated ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                size="large" 
                component={Link} 
                to="/register"
                sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
              >
                Sign Up
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                size="large" 
                component={Link} 
                to="/login"
                sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
              >
                Login
              </Button>
            </Box>
          ) : (
            <Button 
              variant="contained" 
              color="primary" 
              size="large" 
              component={Link} 
              to="/parking-map"
              sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
            >
              View Parking Map
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, height: '100%', borderRadius: 2, transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ color: 'primary.main', fontWeight: 500 }}>
              Find Available Spots
            </Typography>
            <Typography paragraph>
              Browse our interactive map to find available parking spots in real-time.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, height: '100%', borderRadius: 2, transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ color: 'primary.main', fontWeight: 500 }}>
              Reserve in Advance
            </Typography>
            <Typography paragraph>
              Plan ahead by reserving your parking spot before you arrive.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, height: '100%', borderRadius: 2, transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ color: 'primary.main', fontWeight: 500 }}>
              Smart Detection
            </Typography>
            <Typography paragraph>
              Our system uses computer vision to detect available spots and recognize license plates.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default HomePage;