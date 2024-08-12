import React from 'react';
import { Button, Container, Box } from '@material-ui/core';

const Login = () => {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/auth/google';
  };

  return (
    <Container>
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh">
        <Button variant="contained" color="primary" onClick={handleGoogleLogin}>
          Login with Google
        </Button>
      </Box>
    </Container>
  );
};

export default Login;
