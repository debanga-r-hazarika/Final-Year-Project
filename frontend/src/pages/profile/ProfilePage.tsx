import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Container, Box, Typography, Paper, Grid, TextField, Button, Avatar, Divider, Alert } from '@mui/material';
import { selectUser } from '../../store/slices/authSlice';

const ProfilePage: React.FC = () => {
  const user = useSelector(selectUser);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    username: user?.username || ''
  });
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (updateSuccess) setUpdateSuccess(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Will implement update profile functionality
    console.log('Updating profile:', formData);
    setIsEditing(false);
    setUpdateSuccess(true);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 500, color: 'primary.main' }}>
          My Profile
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  margin: '0 auto 16px',
                  bgcolor: 'secondary.main',
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="h5" sx={{ fontWeight: 500 }}>{user?.username}</Typography>
              <Divider sx={{ my: 2 }} />
              <Typography color="text.secondary" sx={{ wordBreak: 'break-word' }}>{user?.email}</Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
              {updateSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Profile updated successfully!
                </Alert>
              )}
              
              <Box component="form" onSubmit={handleSubmit}>
                <Typography variant="h6" gutterBottom sx={{ pb: 1, borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                  Account Information
                </Typography>

                <TextField
                  margin="normal"
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  disabled={!isEditing}
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
                <TextField
                  margin="normal"
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isEditing}
                  variant="outlined"
                  sx={{ mb: 2 }}
                />

                <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-start' }}>
                  {!isEditing ? (
                    <Button
                      variant="contained"
                      onClick={() => setIsEditing(true)}
                      sx={{ px: 3, py: 1 }}
                    >
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="contained"
                        type="submit"
                        sx={{ px: 3, py: 1 }}
                      >
                        Save Changes
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({
                            email: user?.email || '',
                            username: user?.username || ''
                          });
                          setUpdateSuccess(false);
                        }}
                        sx={{ px: 3, py: 1 }}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default ProfilePage;