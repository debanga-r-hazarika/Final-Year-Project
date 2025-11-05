import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, Menu, MenuItem, Avatar, Tooltip, Container, Divider } from '@mui/material';
import { AccountCircle, DirectionsCar, Dashboard } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout, selectIsAuthenticated, selectUser } from '../../store/slices/authSlice';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    handleClose();
    navigate('/');
  };

  const handleProfile = () => {
    handleClose();
    navigate('/profile');
  };

  const handleAdminDashboard = () => {
    handleClose();
    navigate('/admin');
  };

  return (
    <AppBar position="sticky" elevation={4} sx={{ backgroundColor: 'primary.main' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <DirectionsCar sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontWeight: 700,
              letterSpacing: '.1rem',
              color: 'inherit',
              textDecoration: 'none',
              flexGrow: 1
            }}
          >
            Parking Management System
          </Typography>
          
          <DirectionsCar sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontWeight: 700,
              letterSpacing: '.1rem',
              color: 'inherit',
              textDecoration: 'none'
            }}
          >
            PMS
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
            <Button 
              color="inherit" 
              component={Link} 
              to="/parking-map"
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                '&:hover': { backgroundColor: 'primary.dark' }
              }}
            >
              Parking Map
            </Button>
            
            {isAuthenticated ? (
              <>
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/reservations"
                  sx={{ 
                    display: { xs: 'none', sm: 'flex' }, 
                    alignItems: 'center',
                    '&:hover': { backgroundColor: 'primary.dark' }
                  }}
                >
                  My Reservations
                </Button>
                
                <Tooltip title={user?.username || 'Account'}>
                  <IconButton
                    size="large"
                    onClick={handleMenu}
                    color="inherit"
                    aria-label="account of current user"
                    sx={{ ml: 1 }}
                  >
                    {user?.username ? (
                      <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>
                        {user.username[0].toUpperCase()}
                      </Avatar>
                    ) : (
                      <AccountCircle />
                    )}
                  </IconButton>
                </Tooltip>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  PaperProps={{
                    elevation: 3,
                    sx: { mt: 1.5, minWidth: 180 }
                  }}
                >
                  <Box>
                    <MenuItem onClick={handleProfile} sx={{ py: 1.5 }}>
                      <Typography variant="body1">Profile</Typography>
                    </MenuItem>
                    
                    {user?.is_admin && (
                      <Box>
                        <MenuItem onClick={handleAdminDashboard} sx={{ py: 1.5 }}>
                          <Dashboard sx={{ mr: 1, fontSize: 20 }} />
                          <Typography variant="body1">Admin Dashboard</Typography>
                        </MenuItem>
                        <Divider />
                      </Box>
                    )}
                    
                    <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
                      <Typography variant="body1">Logout</Typography>
                    </MenuItem>
                  </Box>
                </Menu>
              </>
            ) : (
              <>
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/login"
                  sx={{ '&:hover': { backgroundColor: 'primary.dark' } }}
                >
                  Login
                </Button>
                <Button 
                  variant="outlined" 
                  color="inherit" 
                  component={Link} 
                  to="/register"
                  sx={{ 
                    borderColor: 'white', 
                    '&:hover': { 
                      backgroundColor: 'white', 
                      color: 'primary.main' 
                    } 
                  }}
                >
                  Register
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header;