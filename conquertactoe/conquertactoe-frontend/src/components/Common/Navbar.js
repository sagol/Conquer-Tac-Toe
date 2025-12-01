import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, IconButton, Badge, Popover } from '@material-ui/core';
import NotificationsIcon from '@material-ui/icons/Notifications';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../../redux/actions/authActions';
import { useNotifications } from '../../context/NotificationContext';
import NotificationList from '../Notifications/NotificationList';

const Navbar = () => {
  const user = useSelector(state => state.auth.user);
  const { unreadCount } = useNotifications();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate('/login');
  };

  const handleNotificationClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

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
            <IconButton color="inherit" onClick={handleNotificationClick} aria-label="Notifications">
              <Badge badgeContent={unreadCount} color="secondary">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <Popover
              id={id}
              open={open}
              anchorEl={anchorEl}
              onClose={handleNotificationClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              PaperProps={{
                style: {
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                  borderRadius: '16px', // Match NotificationList border radius
                },
              }}
            >
              <NotificationList onClose={handleNotificationClose} />
            </Popover>
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
