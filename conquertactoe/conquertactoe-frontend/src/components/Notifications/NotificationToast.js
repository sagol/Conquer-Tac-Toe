import React from 'react';
import { Snackbar, SnackbarContent, IconButton, makeStyles } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import NotificationsIcon from '@material-ui/icons/Notifications';
import { useNotifications } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const useStyles = makeStyles((theme) => ({
    content: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
    },
    contentClickable: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        '&:hover': {
            transform: 'scale(1.02)',
        },
    },
    message: {
        display: 'flex',
        alignItems: 'center',
    },
    icon: {
        marginRight: theme.spacing(1),
    },
}));

const NotificationToast = () => {
    const classes = useStyles();
    const { toast, setToast } = useNotifications();
    const navigate = useNavigate();

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setToast(null);
    };

    const handleToastClick = () => {
        if (!toast) return;

        // Parse game_id from message if present
        const gameIdMatch = toast.message.match(/\|game_id:(\d+)/);
        if (gameIdMatch) {
            const gameId = gameIdMatch[1];
            setToast(null); // Close toast
            navigate(`/game/${gameId}`);
        }
    };

    if (!toast) return null;

    // Check if toast contains a game_id
    const hasGameId = toast.message && toast.message.includes('|game_id:');
    const cleanMessage = toast.message ? toast.message.split('|')[0] : '';

    return (
        <Snackbar
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
            open={Boolean(toast)}
            autoHideDuration={5000}
            onClose={handleClose}
        >
            <SnackbarContent
                className={`${classes.content} ${hasGameId ? classes.contentClickable : ''}`}
                aria-describedby="client-snackbar"
                onClick={hasGameId ? handleToastClick : undefined}
                message={
                    <span id="client-snackbar" className={classes.message}>
                        <NotificationsIcon className={classes.icon} />
                        {cleanMessage}
                    </span>
                }
                action={[
                    <IconButton key="close" aria-label="close" color="inherit" onClick={handleClose}>
                        <CloseIcon />
                    </IconButton>,
                ]}
            />
        </Snackbar>
    );
};

export default NotificationToast;
