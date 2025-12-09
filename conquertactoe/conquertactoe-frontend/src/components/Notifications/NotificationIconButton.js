import React, { useState } from 'react';
import { IconButton, Badge, Popover } from '@material-ui/core';
import NotificationsIcon from '@material-ui/icons/Notifications';
import { useNotifications } from '../../context/NotificationContext';
import NotificationList from './NotificationList';

/**
 * Reusable notification icon button with popover
 * Extracted to avoid code duplication between Navbar and Header
 */
const NotificationIconButton = () => {
    const { unreadCount } = useNotifications();
    const [anchorEl, setAnchorEl] = useState(null);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'notification-popover' : undefined;

    return (
        <>
            <IconButton color="inherit" onClick={handleClick} aria-label="Notifications">
                <Badge badgeContent={unreadCount} color="secondary">
                    <NotificationsIcon />
                </Badge>
            </IconButton>
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
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
                        borderRadius: '16px',
                    },
                }}
            >
                <NotificationList onClose={handleClose} />
            </Popover>
        </>
    );
};

export default NotificationIconButton;
