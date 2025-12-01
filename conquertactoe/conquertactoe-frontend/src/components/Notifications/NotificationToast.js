import React from 'react';
import { Snackbar, SnackbarContent, IconButton, makeStyles } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import NotificationsIcon from '@material-ui/icons/Notifications';
import { useNotifications } from '../../context/NotificationContext';

const useStyles = makeStyles((theme) => ({
    content: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
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

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setToast(null);
    };

    if (!toast) return null;

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
                className={classes.content}
                aria-describedby="client-snackbar"
                message={
                    <span id="client-snackbar" className={classes.message}>
                        <NotificationsIcon className={classes.icon} />
                        {toast.message}
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
