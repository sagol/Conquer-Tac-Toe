import React from 'react';
import {
    List,
    ListItem,
    ListItemText,
    Typography,
    Paper,
    Divider,
    Button,
    Box,
    makeStyles
} from '@material-ui/core';
import { useNotifications } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { NOTIFICATION_GAME_ID_REGEX } from '../../utils/constants';

const useStyles = makeStyles((theme) => ({
    root: {
        width: 400,
        maxHeight: 500,
        overflow: 'auto',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    },
    header: {
        padding: theme.spacing(2.5),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.98) 0%, rgba(118, 75, 162, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        zIndex: 1,
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '16px 16px 0 0',
    },
    headerTitle: {
        color: 'white',
        fontWeight: 700,
        textShadow: '1px 1px 10px rgba(0, 0, 0, 0.2)',
    },
    markAllButton: {
        color: 'white',
        borderColor: 'white',
        textTransform: 'none',
        fontWeight: 600,
        borderRadius: '20px',
        padding: '6px 16px',
        '&:hover': {
            background: 'rgba(255, 255, 255, 0.2)',
            borderColor: 'white',
        },
    },
    notificationItem: {
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        borderRadius: '8px',
        margin: '4px 8px',
        '&:hover': {
            background: 'rgba(255, 255, 255, 0.2)',
            transform: 'translateX(4px)',
        },
    },
    unread: {
        background: 'rgba(255, 255, 255, 0.15)',
        borderLeft: '4px solid #FF6B6B',
    },
    emptyState: {
        padding: theme.spacing(6),
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.9)',
    },
    emptyIcon: {
        fontSize: '3rem',
        marginBottom: theme.spacing(2),
        opacity: 0.7,
    },
    messageText: {
        color: 'white',
    },
    timestamp: {
        fontSize: '0.75rem',
        color: 'rgba(255, 255, 255, 0.8)',
        fontStyle: 'italic',
    },
    divider: {
        background: 'rgba(255, 255, 255, 0.2)',
    },
}));

const NotificationList = ({ onClose }) => {
    const classes = useStyles();
    const { notifications, markAsRead, markAllAsRead } = useNotifications();
    const navigate = useNavigate();

    // Filter notifications from last 30 days
    const recentNotifications = React.useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return notifications
            .filter(n => new Date(n.created_at) > thirtyDaysAgo)
            .slice(0, 20); // Show max 20
    }, [notifications]);

    const handleItemClick = (notification) => {
        if (!notification.is_read) {
            markAsRead(notification.id);
        }

        // Parse game_id from message if present
        const gameIdMatch = notification.message?.match(NOTIFICATION_GAME_ID_REGEX);
        if (gameIdMatch) {
            const gameId = parseInt(gameIdMatch[1], 10);
            // Validate game_id is a positive integer
            if (!isNaN(gameId) && gameId > 0) {
                onClose();
                // Navigate to the game - don't add ?rematch=true for old notifications
                // Real-time rematch requests come through socket events, not from clicking old notifications
                navigate(`/game/${gameId}`);
            }
        }
    };

    return (
        <Paper className={classes.root} elevation={0}>
            <div className={classes.header}>
                <Typography variant="h6" className={classes.headerTitle}>
                    Notifications
                </Typography>
                {recentNotifications.length > 0 && (
                    <Button
                        size="small"
                        variant="outlined"
                        className={classes.markAllButton}
                        onClick={markAllAsRead}
                        aria-label="Mark all notifications as read"
                    >
                        Mark all read
                    </Button>
                )}
            </div>

            {recentNotifications.length === 0 ? (
                <div className={classes.emptyState}>
                    <div className={classes.emptyIcon}>🔔</div>
                    <Typography variant="body1">No new notifications</Typography>
                    <Typography variant="body2" style={{ marginTop: 8, opacity: 0.8 }}>
                        You're all caught up!
                    </Typography>
                </div>
            ) : (
                <List disablePadding>
                    {recentNotifications.map((notification, index) => {
                        // Clean message text (remove metadata)
                        const cleanMessage = notification.message?.split('|')[0] || '';

                        return (
                            <React.Fragment key={notification.id}>
                                <ListItem
                                    button
                                    className={`${classes.notificationItem} ${!notification.is_read ? classes.unread : ''}`}
                                    onClick={() => handleItemClick(notification)}
                                >
                                    <ListItemText
                                        primary={
                                            <Typography
                                                variant="body2"
                                                className={classes.messageText}
                                                style={{ fontWeight: !notification.is_read ? 'bold' : 'normal' }}
                                            >
                                                {cleanMessage}
                                            </Typography>
                                        }
                                        secondary={
                                            <span className={classes.timestamp}>
                                                {new Date(notification.created_at).toLocaleString()}
                                            </span>
                                        }
                                    />
                                </ListItem>
                                {index < recentNotifications.length - 1 && (
                                    <Divider className={classes.divider} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </List>
            )}

            {notifications.length > 20 && recentNotifications.length === 20 && (
                <Box p={2} textAlign="center" borderTop="1px solid rgba(255, 255, 255, 0.2)">
                    <Typography variant="caption" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                        Showing 20 most recent notifications
                    </Typography>
                </Box>
            )}
        </Paper>
    );
};

export default NotificationList;
