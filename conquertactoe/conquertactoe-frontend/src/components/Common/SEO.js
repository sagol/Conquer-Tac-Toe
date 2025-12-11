import React from 'react';
import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';

const SEO = ({ title, description, keywords, image, url, type }) => {
    const siteTitle = 'Conquer-Tac-Toe | Strategic Tic-Tac-Toe Variant Game';
    const siteDescription = description || 'Play Conquer-Tac-Toe, an advanced strategic variant of Tic-Tac-Toe with cones, territory control, and multiple game modes including Gomoku. Play online or against AI.';
    const siteKeywords = keywords || 'tic tac toe, gomoku, strategy game, board game, online game, ai bot, conquer tac toe, react game';
    const siteImage = image || '%PUBLIC_URL%/og-image.png';
    const siteUrl = url || 'https://conquertactoe.com/';
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

SEO.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    keywords: PropTypes.string,
    image: PropTypes.string,
    url: PropTypes.string,
    type: PropTypes.string,
};

export default SEO;
