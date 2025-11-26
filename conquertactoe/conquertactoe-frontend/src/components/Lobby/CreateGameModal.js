import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Box,
    RadioGroup,
    FormControlLabel,
    Radio,
    TextField,
    CircularProgress
} from '@material-ui/core';
import { fetchGameVariants, selectVariant } from '../../redux/actions/gameVariantActions';
import './CreateGameModal.css';

const CreateGameModal = ({ open, onClose, onCreate }) => {
    const dispatch = useDispatch();
    const { variants, selectedVariantId, loading } = useSelector(state => state.gameVariants);

    const [gameType, setGameType] = useState('public');
    const [boardSize, setBoardSize] = useState(15); // For Gomoku
    const [customCones, setCustomCones] = useState({ small: 3, medium: 3, large: 2 });

    useEffect(() => {
        if (open && variants.length === 0) {
            dispatch(fetchGameVariants());
        }
    }, [open, variants, dispatch]);

    const selectedVariant = variants.find(v => v.variant_id === selectedVariantId);

    const handleCreate = () => {
        const gameData = {
            gameType: gameType,
            variantId: selectedVariantId
        };

        // Add custom data for specific variants
        if (selectedVariant?.name === 'conquer_custom') {
            gameData.customCones = customCones;
        }
        if (selectedVariant?.name === 'five_in_line') {
            gameData.boardSize = boardSize;
        }

        onCreate(gameData);
        onClose();
    };

    const handleConeChange = (size, value) => {
        const num = parseInt(value) || 0;
        setCustomCones(prev => ({
            ...prev,
            [size]: Math.max(0, Math.min(5, num))
        }));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth className="create-game-modal">
            <DialogTitle className="modal-title">Create New Game</DialogTitle>

            <DialogContent className="modal-content">
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {/* Variant Selection */}
                        <FormControl fullWidth margin="normal" className="form-control">
                            <InputLabel id="game-variant-label" shrink>Game Variant</InputLabel>
                            <Select
                                native
                                labelId="game-variant-label"
                                id="game-variant-select"
                                data-testid="game-variant-select"
                                value={selectedVariantId}
                                onChange={(e) => dispatch(selectVariant(parseInt(e.target.value, 10)))}
                                label="Game Variant"
                                inputProps={{
                                    name: 'variant',
                                    id: 'game-variant-native-select',
                                }}
                            >
                                <option value="" disabled>
                                    Select a variant
                                </option>
                                {variants.map(variant => (
                                    <option
                                        key={variant.variant_id}
                                        value={variant.variant_id}
                                        data-testid={`variant-option-${variant.name}`}
                                    >
                                        {variant.display_name}
                                    </option>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Variant Description */}
                        {selectedVariant && (
                            <Box className="variant-description">
                                <Typography variant="body2">
                                    {selectedVariant.description}
                                </Typography>
                                <Typography variant="caption" display="block" style={{ marginTop: '8px' }}>
                                    Board: {selectedVariant.board_size}x{selectedVariant.board_size} |
                                    Win Condition: {selectedVariant.rules.requireLineLength} in a row
                                    {selectedVariant.rules.allowOverwrite && (
                                        <> | Overwrite: {selectedVariant.rules.overwriteRules === 'larger_cone_only' ? 'Larger Only' : 'Larger or Equal'}</>
                                    )}
                                </Typography>
                            </Box>
                        )}

                        {/* Board Size Selection (for Gomoku) */}
                        {selectedVariant?.name === 'five_in_line' && (
                            <FormControl fullWidth margin="normal" className="form-control">
                                <InputLabel id="board-size-label" shrink>Board Size</InputLabel>
                                <Select
                                    native
                                    labelId="board-size-label"
                                    id="board-size-select"
                                    data-testid="board-size-select"
                                    value={boardSize}
                                    onChange={(e) => setBoardSize(e.target.value)}
                                    label="Board Size"
                                    inputProps={{
                                        name: 'boardSize',
                                        id: 'board-size-native-select',
                                    }}
                                >
                                    {selectedVariant.rules.boardSizeOptions?.map(size => (
                                        <option key={size} value={size} data-testid={`board-size-${size}`}>
                                            {size}x{size}
                                        </option>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {/* Custom Cones Config (for Custom variant) */}
                        {selectedVariant?.name === 'conquer_custom' && (
                            <Box className="custom-cones-container">
                                <Typography variant="subtitle2" gutterBottom>
                                    Customize Your Cones (0-5 each)
                                </Typography>
                                <Box display="flex" gap={2} justifyContent="space-between">
                                    <TextField
                                        label="Small Cones"
                                        type="number"
                                        inputProps={{ min: 0, max: 5 }}
                                        value={customCones.small}
                                        onChange={(e) => handleConeChange('small', e.target.value)}
                                        className="cone-input"
                                    />
                                    <TextField
                                        label="Medium Cones"
                                        type="number"
                                        inputProps={{ min: 0, max: 5 }}
                                        value={customCones.medium}
                                        onChange={(e) => handleConeChange('medium', e.target.value)}
                                        className="cone-input"
                                    />
                                    <TextField
                                        label="Large Cones"
                                        type="number"
                                        inputProps={{ min: 0, max: 5 }}
                                        value={customCones.large}
                                        onChange={(e) => handleConeChange('large', e.target.value)}
                                        className="cone-input"
                                    />
                                </Box>
                            </Box>
                        )}

                        {/* Game Type Selection */}
                        <FormControl component="fieldset" margin="normal" className="game-type-control">
                            <Typography variant="subtitle1" gutterBottom>Game Type</Typography>
                            <RadioGroup value={gameType} onChange={(e) => setGameType(e.target.value)} data-testid="game-type-radio-group">
                                <FormControlLabel
                                    value="public"
                                    control={<Radio id="game-type-public" data-testid="game-type-public" />}
                                    label="Public Game (Anyone can join)"
                                />
                                <FormControlLabel
                                    value="bot"
                                    control={<Radio id="game-type-bot" data-testid="game-type-bot" />}
                                    label="Play vs AI Bot"
                                />
                            </RadioGroup>
                        </FormControl>
                    </>
                )}
            </DialogContent>

            <DialogActions className="modal-actions">
                <Button onClick={onClose} className="cancel-button" data-testid="cancel-button">
                    Cancel
                </Button>
                <Button
                    onClick={handleCreate}
                    variant="contained"
                    className="create-button"
                    disabled={loading}
                    data-testid="create-game-button"
                >
                    Create Game
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateGameModal;
