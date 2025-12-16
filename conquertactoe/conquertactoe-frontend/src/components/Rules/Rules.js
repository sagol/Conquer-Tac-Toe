import React from 'react';
import '../Common/SharedModernStyles.css';
import SEO from '../Common/SEO';
import './Rules.css';

const Rules = () => {
    return (
        <div className="rules-container modern-container">
            <SEO
                title="Game Rules"
                description="Learn the rules of Conquer-Tac-Toe, Gomoku, and Classic Tic-Tac-Toe. Master cone sizes and winning strategies."
                keywords="game rules, how to play, gomoku rules, tic tac toe rules, strategy guide"
            />
            <div className="rules-section">
                <h2>1. Classic Tic-Tac-Toe</h2>
                <p>The traditional game you know and love.</p>
                <ul>
                    <li><strong>Board Size:</strong> 3x3</li>
                    <li><strong>Goal:</strong> Get 3 in a row (horizontal, vertical, or diagonal)</li>
                    <li><strong>Pieces:</strong> Simple markers (X and O)</li>
                    <li><strong>Special:</strong> No overwriting allowed. Once placed, a piece stays.</li>
                </ul>
            </div>

            <div className="rules-section">
                <h2>2. 5-in-Line (Gomoku)</h2>
                <p>A larger scale strategy game.</p>
                <ul>
                    <li><strong>Board Size:</strong> 15x15 (Standard)</li>
                    <li><strong>Goal:</strong> Get 5 in a row</li>
                    <li><strong>Pieces:</strong> Black and White stones</li>
                    <li><strong>Special:</strong> First to exactly 5 wins. No overwriting.</li>
                </ul>
            </div>

            <div className="rules-section">
                <h2>3. Conquer-Tac-Toe (Classic)</h2>
                <p>The signature game mode with tactical depth.</p>
                <ul>
                    <li><strong>Board Size:</strong> 3x3</li>
                    <li><strong>Goal:</strong> Get 3 in a row</li>
                    <li><strong>Pieces:</strong> Cones of 3 sizes (Small, Medium, Large)</li>
                    <li><strong>Inventory:</strong> 3 Small, 3 Medium, 2 Large per player</li>
                    <li><strong>Overwrite Rule:</strong> You can place a cone on top of an existing one ONLY if yours is <strong>LARGER</strong>.</li>
                </ul>
            </div>

            <div className="rules-section">
                <h2>4. Conquer-Tac-Toe (Same-Size Replace)</h2>
                <p>Advanced variant with aggressive play.</p>
                <ul>
                    <li><strong>Board Size:</strong> 3x3</li>
                    <li><strong>Goal:</strong> Get 3 in a row</li>
                    <li><strong>Overwrite Rule:</strong> You can place a cone on top if yours is <strong>LARGER OR EQUAL SIZE</strong>.</li>
                    <li>This makes positions change frequently!</li>
                </ul>
            </div>

            <div className="rules-section">
                <h2>5. Conquer-Tac-Toe (Custom)</h2>
                <p>Customize your strategy.</p>
                <ul>
                    <li><strong>Board Size:</strong> 3x3</li>
                    <li><strong>Goal:</strong> Get 3 in a row</li>
                    <li><strong>Inventory:</strong> You choose your cone counts (Max 5 of each size).</li>
                    <li><strong>Overwrite Rule:</strong> Standard (Larger covers Smaller).</li>
                </ul>
            </div>
        </div>
    );
};

export default Rules;
