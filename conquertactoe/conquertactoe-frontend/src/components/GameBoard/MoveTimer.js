import React, { useState, useEffect } from 'react';
import './MoveTimer.css';

/**
 * MoveTimer - Displays countdown timer for current player's move
 * 
 * @param {Date|string} lastMoveAt - Timestamp of the last move
 * @param {number} timeoutSeconds - Maximum time allowed for a move (default 300s = 5 min)
 * @param {boolean} isMyTurn - Whether it's the current user's turn
 * @param {boolean} gameActive - Whether the game is still active
 */

// Calculate time left given lastMoveAt and timeoutSeconds
const calculateTimeLeft = (lastMoveTimestamp, timeoutLimit) => {
    const lastMove = new Date(lastMoveTimestamp);
    const now = new Date();
    const elapsed = Math.floor((now - lastMove) / 1000);
    const remaining = Math.max(0, timeoutLimit - elapsed);
    return remaining;
};

const MoveTimer = ({ lastMoveAt, timeoutSeconds = 300, isMyTurn, gameActive, onTimeout }) => {
    const [timeLeft, setTimeLeft] = useState(timeoutSeconds);
    const [isWarning, setIsWarning] = useState(false);
    const [isCritical, setIsCritical] = useState(false);

    // calculateTimeLeft moved outside component for performance

    useEffect(() => {
        if (!gameActive || !lastMoveAt) {
            setTimeLeft(timeoutSeconds);
            return;
        }

        // Initial calculation
        const initialRemaining = calculateTimeLeft(lastMoveAt, timeoutSeconds);
        setTimeLeft(initialRemaining);
        setIsWarning(initialRemaining <= 60 && initialRemaining > 30);
        setIsCritical(initialRemaining <= 30);

        // Update every second
        const interval = setInterval(() => {
            const remaining = calculateTimeLeft(lastMoveAt, timeoutSeconds);
            setTimeLeft(remaining);
            setIsWarning(remaining <= 60 && remaining > 30);
            setIsCritical(remaining <= 30);

            // Trigger timeout callback if provided and time ran out
            if (remaining === 0 && onTimeout) {
                onTimeout();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [lastMoveAt, timeoutSeconds, gameActive]);

    if (!gameActive) {
        return null;
    }

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const timerClass = `move-timer ${isMyTurn ? 'my-turn' : 'opponent-turn'} ${isWarning ? 'warning' : ''} ${isCritical ? 'critical' : ''}`;

    return (
        <div className={timerClass}>
            <div className="timer-icon">⏱️</div>
            <div className="timer-content">
                <div className="timer-label">
                    {isMyTurn ? 'Your time' : "Opponent's time"}
                </div>
                <div className="timer-value">
                    {formatTime(timeLeft)}
                </div>
            </div>
            {isMyTurn && isCritical && (
                <div className="timer-alert">Hurry!</div>
            )}
        </div>
    );
};

export default MoveTimer;
