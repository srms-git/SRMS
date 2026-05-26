import { Navigate } from "react-router-dom";
import authService from "@/services/authService";

export const ProtectedRoute = ({ children, allowedRoles }) => {
  // 1. Redirect to login if no token or authentication session is found
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // 2. If specific roles are required for this route, validate the user's role payload
  if (allowedRoles && allowedRoles.length > 0) {
    // Extract current user profile information from authService
    const currentUser = authService.getCurrentUser?.() || {}; 
    const userRole = currentUser.role || "";

    // If the user's role isn't inside the route's allowed array, redirect them safely
    if (!allowedRoles.includes(userRole)) {
      if (userRole === "cashier") {
        return <Navigate to="/cashier/dashboard" replace />;
      } else if (userRole === "osgfa") {
        return <Navigate to="/osgfa/dashboard" replace />;
      } else {
        // Fallback catch-all redirection to landing/public page if role is unknown
        return <Navigate to="/" replace />;
      }
    }
  }

  // 3. Render children components if authorized
  return children;
};