const GameVariant = require('../models/GameVariant');

/**
 * Get all active game variants
 * GET /api/variants
 */
exports.getAllVariants = async (req, res) => {
    try {
        const variants = await GameVariant.getAll();
        res.json(variants);
    } catch (error) {
        console.error('Error fetching variants:', error);
        res.status(500).json({ error: 'Failed to fetch game variants' });
    }
};

/**
 * Get specific variant by ID
 * GET /api/variants/:id
 */
exports.getVariantById = async (req, res) => {
    try {
        const variant = await GameVariant.getById(req.params.id);
        if (!variant) {
            return res.status(404).json({ error: 'Variant not found' });
        }
        res.json(variant);
    } catch (error) {
        console.error('Error fetching variant:', error);
        res.status(500).json({ error: 'Failed to fetch variant' });
    }
};

/**
 * Get variant rules details
 * GET /api/variants/:id/rules
 */
exports.getVariantRules = async (req, res) => {
    try {
        const variant = await GameVariant.getById(req.params.id);
        if (!variant) {
            return res.status(404).json({ error: 'Variant not found' });
        }

        res.json({
            variant_id: variant.variant_id,
            display_name: variant.display_name,
            rules: variant.rules,
            board_size: variant.board_size,
            cones: {
                player1: variant.player1_cones,
                player2: variant.player2_cones
            }
        });
    } catch (error) {
        console.error('Error fetching variant rules:', error);
        res.status(500).json({ error: 'Failed to fetch variant rules' });
    }
};
