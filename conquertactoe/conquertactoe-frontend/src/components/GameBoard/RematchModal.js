import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RematchModal.css';

/**
 * RematchModal - Handles PvP rematch flow
 * 
 * States:
 * - 'idle': No active rematch request
 * - 'requesting': Waiting for opponent response
 * - 'received': Opponent requested rematch
 * - 'accepted': Match starting, redirecting
 * - 'declined': Opponent declined
 * - 'timeout': 60-second timer expired
 * - 'cancelled': Request was cancelled
 */
const RematchModal = ({
    socket,
    gameId,
    opponentId,
    opponentName,
    currentUserId,
    variantId,
    onClose,
    onCreatePublicGame,
    isVisible,
    initialState, // 'received' when opened from socket event
    initialRequesterName // Name of player who requested rematch
}) => {
    const navigate = useNavigate();
    const [state, setState] = useState('idle');
    const [countdown, setCountdown] = useState(60);
    const [requesterName, setRequesterName] = useState('');

    // Reset state when modal opens, or use initial state if provided
    // Don't reset if we're in 'accepted' state (waiting for navigation)
    useEffect(() => {
        if (isVisible && state !== 'accepted') {
            if (initialState === 'received') {
                setState('received');
                setRequesterName(initialRequesterName || opponentName || 'Opponent');
                setCountdown(60);
            } else if (state !== 'requesting' && state !== 'received') {
                // Only reset to idle if we're not already in an active state
                setState('idle');
                setCountdown(60);
            }
        }
    }, [isVisible, gameId, initialState, initialRequesterName, opponentName]);

    // Countdown timer
    useEffect(() => {
        if ((state === 'requesting' || state === 'received') && countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [state, countdown]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        const handleRematchRequested = ({ gameId: reqGameId, requesterId, requesterName: name, timeoutMs }) => {
            if (reqGameId === parseInt(gameId)) {
                console.log('[RematchModal] Received rematch request from', name);
                setState('received');
                setRequesterName(name);
                setCountdown(Math.floor(timeoutMs / 1000));
            }
        };

        const handleRematchRequestSent = ({ gameId: reqGameId, timeoutMs }) => {
            if (reqGameId === parseInt(gameId)) {
                console.log('[RematchModal] Rematch request sent');
                setState('requesting');
                setCountdown(Math.floor(timeoutMs / 1000));
            }
        };

        const handleRematchAccepted = ({ newGameId, originalGameId }) => {
            if (originalGameId === parseInt(gameId)) {
                console.log('[RematchModal] Rematch accepted! Navigating immediately to new game:', newGameId);
                setState('accepted');
                // Navigate IMMEDIATELY to prevent race condition with modal state reset
                navigate(`/game/${newGameId}`);
            }
        };

        const handleRematchDeclined = ({ gameId: reqGameId }) => {
            if (reqGameId === parseInt(gameId)) {
                console.log('[RematchModal] Rematch declined');
                setState('declined');
            }
        };

        const handleRematchTimeout = ({ gameId: reqGameId }) => {
            if (reqGameId === parseInt(gameId)) {
                console.log('[RematchModal] Rematch timeout');
                setState('timeout');
            }
        };

        const handleRematchCancelled = ({ gameId: reqGameId }) => {
            if (reqGameId === parseInt(gameId)) {
                console.log('[RematchModal] Rematch cancelled by opponent');
                setState('cancelled');
            }
        };

        const handleRematchError = ({ message }) => {
            console.error('[RematchModal] Rematch error:', message);

            // If authentication error, force socket reconnection silently
            if (message === 'Not authenticated') {
                console.log('[RematchModal] Authentication failed, forcing socket reconnection...');
                // Disconnect and reconnect to refresh session
                socket.disconnect();
                setTimeout(() => {
                    socket.connect();
                }, 500);
            }

            setState('idle');
        };

        socket.on('rematchRequested', handleRematchRequested);
        socket.on('rematchRequestSent', handleRematchRequestSent);
        socket.on('rematchAccepted', handleRematchAccepted);
        socket.on('rematchDeclined', handleRematchDeclined);
        socket.on('rematchTimeout', handleRematchTimeout);
        socket.on('rematchCancelled', handleRematchCancelled);
        socket.on('rematchError', handleRematchError);

        return () => {
            socket.off('rematchRequested', handleRematchRequested);
            socket.off('rematchRequestSent', handleRematchRequestSent);
            socket.off('rematchAccepted', handleRematchAccepted);
            socket.off('rematchDeclined', handleRematchDeclined);
            socket.off('rematchTimeout', handleRematchTimeout);
            socket.off('rematchCancelled', handleRematchCancelled);
            socket.off('rematchError', handleRematchError);
        };
    }, [socket, gameId, navigate]);

    const handleRequestRematch = useCallback(() => {
        if (!socket) return;
        console.log('[RematchModal] Sending rematch request');
        socket.emit('requestRematch', { gameId: parseInt(gameId), opponentId });
    }, [socket, gameId, opponentId]);

    const handleAcceptRematch = async () => {
        console.log('[RematchModal] Accepting rematch via HTTP');
        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
            const response = await axios.post(
                `${backendUrl}/game-requests/${gameId}/accept-rematch`,
                {},
                { withCredentials: true }
            );

            if (response.data.success && response.data.newGameId) {
                console.log('[RematchModal] Rematch accepted! Navigating to new game:', response.data.newGameId);
                setState('accepted');
                navigate(`/game/${response.data.newGameId}`);
            } else if (response.data.waiting) {
                console.log('[RematchModal] Waiting for other player to accept');
                // Show waiting state
                setState('requesting');
            }
        } catch (error) {
            console.error('[RematchModal] Error accepting rematch:', error);
            if (error.response?.data?.error) {
                console.error('[RematchModal] Server error:', error.response.data.error);
            }
            setState('idle');
        }
    };

    const handleDeclineRematch = useCallback(() => {
        if (!socket) return;
        console.log('[RematchModal] Declining rematch');
        socket.emit('declineRematch', { gameId: parseInt(gameId) });
        setState('idle');
        onClose?.();
    }, [socket, gameId, onClose]);

    const handleCancelRematch = useCallback(() => {
        if (!socket) return;
        console.log('[RematchModal] Cancelling rematch request');
        socket.emit('cancelRematch', { gameId: parseInt(gameId) });
        setState('idle');
    }, [socket, gameId]);

    const handleCreatePublicGame = useCallback(() => {
        onCreatePublicGame?.();
        onClose?.();
    }, [onCreatePublicGame, onClose]);

    const handleReturnToLobby = useCallback(() => {
        navigate('/lobby');
    }, [navigate]);

    if (!isVisible) return null;

    const renderContent = () => {
        switch (state) {
            case 'idle':
                return (
                    <div className="rematch-content">
                        <h2>Play Again?</h2>
                        <p>Challenge {opponentName || 'your opponent'} to a rematch!</p>
                        <div className="rematch-buttons">
                            <button className="rematch-btn primary" onClick={handleRequestRematch}>
                                Request Rematch
                            </button>
                            <button className="rematch-btn secondary" onClick={handleCreatePublicGame}>
                                Create New Public Game
                            </button>
                            <button className="rematch-btn tertiary" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                );

            case 'requesting':
                return (
                    <div className="rematch-content">
                        <h2>Waiting for {opponentName || 'Opponent'}...</h2>
                        <div className="countdown-circle">
                            <span className="countdown-number">{countdown}</span>
                        </div>
                        <p className="countdown-label">seconds remaining</p>
                        <div className="rematch-buttons">
                            <button className="rematch-btn secondary" onClick={handleCancelRematch}>
                                Cancel Request
                            </button>
                        </div>
                    </div>
                );

            case 'received':
                return (
                    <div className="rematch-content">
                        <h2>🎮 Rematch Request!</h2>
                        <p><strong>{requesterName || 'Your opponent'}</strong> wants a rematch!</p>
                        <div className="countdown-circle">
                            <span className="countdown-number">{countdown}</span>
                        </div>
                        <p className="countdown-label">seconds to respond</p>
                        <div className="rematch-buttons">
                            <button className="rematch-btn primary" onClick={() => handleAcceptRematch()}>
                                Accept
                            </button>
                            <button className="rematch-btn secondary" onClick={handleDeclineRematch}>
                                Decline
                            </button>
                        </div>
                    </div>
                );

            case 'accepted':
                return (
                    <div className="rematch-content">
                        <h2>✅ Match Starting!</h2>
                        <div className="loading-spinner"></div>
                        <p>Redirecting to new game...</p>
                    </div>
                );

            case 'declined':
                return (
                    <div className="rematch-content">
                        <h2>😔 Rematch Declined</h2>
                        <p>{opponentName || 'Your opponent'} declined the rematch.</p>
                        <div className="rematch-buttons">
                            <button className="rematch-btn primary" onClick={handleCreatePublicGame}>
                                Create New Public Game
                            </button>
                            <button className="rematch-btn secondary" onClick={handleReturnToLobby}>
                                Return to Lobby
                            </button>
                        </div>
                    </div>
                );

            case 'timeout':
                return (
                    <div className="rematch-content">
                        <h2>⏰ Time Expired</h2>
                        <p>The rematch request has timed out.</p>
                        <div className="rematch-buttons">
                            <button className="rematch-btn primary" onClick={handleCreatePublicGame}>
                                Create New Public Game
                            </button>
                            <button className="rematch-btn secondary" onClick={handleReturnToLobby}>
                                Return to Lobby
                            </button>
                        </div>
                    </div>
                );

            case 'cancelled':
                return (
                    <div className="rematch-content">
                        <h2>Request Cancelled</h2>
                        <p>The rematch request was cancelled.</p>
                        <div className="rematch-buttons">
                            <button className="rematch-btn primary" onClick={handleCreatePublicGame}>
                                Create New Public Game
                            </button>
                            <button className="rematch-btn secondary" onClick={handleReturnToLobby}>
                                Return to Lobby
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="rematch-modal-overlay">
            <div className="rematch-modal glass-panel">
                {renderContent()}
            </div>
        </div>
    );
};

export default RematchModal;
