import React, { ReactNode } from 'react';
import { Container, Box, Typography, Divider, Link as MuiLink } from '@mui/material';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          py: { xs: 3, md: 4 }, 
          px: { xs: 2, sm: 3, md: 4 },
          maxWidth: { xl: 'xl' }
        }}
      >
        {children}
      </Container>
      <Box 
        component="footer" 
        sx={{ 
          py: 3, 
          mt: 4,
          textAlign: 'center', 
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          boxShadow: '0px -2px 10px rgba(0, 0, 0, 0.05)'
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Smart Parking Management System
          </Typography>
          <Divider sx={{ width: '200px', mx: 'auto', my: 1.5 }} />
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} All Rights Reserved
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;