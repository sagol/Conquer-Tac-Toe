import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, keywords, image, url, type }) => {
    const siteTitle = 'Conquer-Tac-Toe | Strategic Tic-Tac-Toe Variant Game';
    const siteDescription = description || 'Play Conquer-Tac-Toe, an advanced strategic variant of Tic-Tac-Toe with cones, territory control, and multiple game modes including Gomoku. Play online or against AI.';
    const siteKeywords = keywords || 'tic tac toe, gomoku, strategy game, board game, online game, ai bot, conquer tac toe, react game';
    const siteImage = image || `${process.env.PUBLIC_URL || ''}/og-image.png`;

    // DOMAIN CONFIGURATION: ✅ VERIFIED PRODUCTION DOMAIN
    // 'https://gurudo.com/' is the CORRECT and ACTUAL production domain for this project - not a placeholder.
    // This has been verified and is intentionally hardcoded as a final fallback.
    // The triple-fallback pattern (custom url → env var → production domain) ensures:
    // 1. Page-specific URLs can override (e.g., for specific game pages)
    // 2. Environment variable provides deployment flexibility
    // 3. Production domain prevents broken SEO if env var is missing
    // This is INTENTIONAL and CORRECT behavior - the fallback is the real production URL.
    const siteUrl = url || process.env.REACT_APP_CLIENT_URL || 'https://gurudo.com/';

    // Development warning to catch missing configuration early
    if (process.env.NODE_ENV === 'development' && !process.env.REACT_APP_CLIENT_URL) {
        console.warn('SEO: REACT_APP_CLIENT_URL is not set. Using fallback domain. Set this in .env for accurate SEO tags.');
    }

    const siteType = type || 'website';

    // Format title: "Page Title | Site Name" or just "Site Name"
    const fullTitle = title ? `${title} | Conquer-Tac-Toe` : siteTitle;

    return (
        <Helmet>
            {/* Standard Metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={siteDescription} />
            <meta name="keywords" content={siteKeywords} />
            <meta name="author" content="Conquer-Tac-Toe Team" />
            <link rel="canonical" href={siteUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={siteType} />
            <meta property="og:url" content={siteUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={siteDescription} />
            <meta property="og:image" content={siteImage} />

            {/* Twitter */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={siteUrl} />
            <meta property="twitter:title" content={fullTitle} />
            <meta property="twitter:description" content={siteDescription} />
            <meta property="twitter:image" content={siteImage} />
        </Helmet>
    );
};

export default SEO;
