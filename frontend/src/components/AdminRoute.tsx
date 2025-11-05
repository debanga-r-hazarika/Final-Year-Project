import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';

interface AdminRouteProps {
  children: React.ReactElement;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const user = useSelector(selectUser);
  
  console.log('AdminRoute - Current user:', user);
  console.log('AdminRoute - Is admin:', user?.is_admin);
  
  if (!user) {
    console.log('AdminRoute - No user found, redirecting to home');
    return <Navigate to="/" replace />;
  }
  
  if (!user.is_admin) {
    console.log('AdminRoute - User is not an admin, redirecting to home');
    return <Navigate to="/" replace />;
  }
  
  console.log('AdminRoute - User is admin, allowing access');
  return children;
};

export default AdminRoute;