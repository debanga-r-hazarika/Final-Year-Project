import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Container, Box, Typography, Paper, Button, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { selectUser, selectIsAuthenticated, fetchCurrentUser } from '../store/slices/authSlice';
import { AppDispatch } from '../store';

const AccessCheckPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, isAuthenticated]);
  
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Authentication Debug
        </Typography>
        
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Authentication Status
          </Typography>
          
          <Typography variant="body1" paragraph>
            <strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}
          </Typography>
          
          {user ? (
            <>
              <Typography variant="body1" paragraph>
                <strong>Username:</strong> {user.username}
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Email:</strong> {user.email}
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Admin Status:</strong> {user.is_admin ? 'Admin' : 'Not Admin'}
              </Typography>
              
              {user.is_admin ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  You have admin privileges. You should be able to access the admin dashboard.
                </Alert>
              ) : (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  You do not have admin privileges. You will not be able to access the admin dashboard.
                </Alert>
              )}
            </>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Not logged in or user data not loaded yet.
            </Alert>
          )}
        </Paper>
        
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button variant="contained" color="primary" onClick={() => navigate('/admin')}>
            Try Admin Dashboard
          </Button>
          <Button variant="outlined" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default AccessCheckPage; 