import React from 'react';
import { AppBar, Toolbar, Typography, Button } from '@material-ui/core';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../../redux/actions/authActions';

const Navbar = () => {
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <AppBar position="static" component="nav" aria-label="Main Navigation">
      <Toolbar>
        <Typography variant="h6" component="h1" style={{ flexGrow: 1 }}>
          Conquer-Tac-Toe
        </Typography>
        <Button color="inherit" component={Link} to="/" aria-label="Home">Home</Button>
        <Button color="inherit" component={Link} to="/rules" aria-label="Rules">Rules</Button>
        <Button color="inherit" component={Link} to="/leaderboard" aria-label="Leaderboard">Leaderboard</Button>
        {user ? (
          <>
            <Button color="inherit" component={Link} to="/profile" aria-label="Profile">Profile</Button>
            <Button color="inherit" component={Link} to="/lobby" aria-label="Lobby">Lobby</Button>
            <Button color="inherit" onClick={handleLogout} aria-label="Logout">Logout</Button>
          </>
        ) : (
          <Button color="inherit" component={Link} to="/login" aria-label="Login">Login</Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
