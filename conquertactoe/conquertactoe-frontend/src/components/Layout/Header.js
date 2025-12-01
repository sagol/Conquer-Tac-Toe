import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, IconButton, Badge, Popover } from '@material-ui/core';
import NotificationsIcon from '@material-ui/icons/Notifications';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import NotificationList from '../Notifications/NotificationList';
import { useSelector } from 'react-redux';

const Header = () => {
  const { unreadCount } = useNotifications();
  const user = useSelector(state => state.auth.user);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleNotificationClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" style={{ flexGrow: 1 }}>
          Conquer-Tac-Toe
        </Typography>
        <Button color="inherit" component={Link} to="/">
          Home
        </Button>
        <Button color="inherit" component={Link} to="/profile">
          Profile
        </Button>
        <Button color="inherit" component={Link} to="/game-lobby">
          Game Lobby
        </Button>
        <Button color="inherit" component={Link} to="/leaderboard">
          Leaderboard
        </Button>

        {user && (
          <>
            <IconButton color="inherit" onClick={handleNotificationClick}>
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
            >
              <NotificationList onClose={handleNotificationClose} />
            </Popover>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
