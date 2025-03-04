import express from 'express';
import { computePortfolioStream, getRates } from './portfolioService.js';

const app = express();
const PORT = process.env.PORT || 3000;

/**
* Utility function to parse input parameters.
* If date exists, convert to timestamp; otherwise, use current time.
*/
function parseCutoffTimestamp(dateParam) {
    if (dateParam) {
        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }
        return Math.floor(date.getTime() / 1000);
    }
    return Math.floor(Date.now() / 1000);
}

/**
 * Endpoint: GET /portfolio
 * Given no parameters, return the latest portfolio value per token in USD.
 */
app.get('/portfolio', async (req, res) => {
    try {
        const cutoffTimestamp = parseCutoffTimestamp();
        const portfolioMap = await computePortfolioStream(cutoffTimestamp);
        const tokens = Array.from(portfolioMap.keys());
        const rates = await getRates(tokens);
        const result = {};
        tokens.forEach((token) => {
            const balance = portfolioMap.get(token);
            const rate = rates[token] || 0;
            result[token] = {
                balance,
                usdValue: +(balance * rate).toFixed(2),
            };
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Endpoint: GET /portfolio/:token
 * Given a token, return the latest portfolio value for that token in USD.
 */
app.get('/portfolio/:token', async (req, res) => {
    try {
        const tokenParam = req.params.token.toUpperCase();
        const cutoffTimestamp = parseCutoffTimestamp();
        const portfolioMap = await computePortfolioStream(cutoffTimestamp);
        const balance = portfolioMap.get(tokenParam) || 0;
        const rates = await getRates([tokenParam]);
        const rate = rates[tokenParam] || 0;
        res.json({
            token: tokenParam,
            balance,
            usdValue: +(balance * rate).toFixed(2),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Endpoint: GET /portfolio/date/:date
 * Given a date, return the portfolio value per token in USD on that date.
 */
app.get('/portfolio/date/:date', async (req, res) => {
    try {
        const dateParam = req.params.date;
        const cutoffTimestamp = parseCutoffTimestamp(dateParam);
        const portfolioMap = await computePortfolioStream(cutoffTimestamp);
        const tokens = Array.from(portfolioMap.keys());
        const rates = await getRates(tokens, cutoffTimestamp);
        const result = {};
        tokens.forEach((token) => {
            const balance = portfolioMap.get(token);
            const rate = rates[token] || 0;
            result[token] = {
                balance,
                usdValue: +(balance * rate).toFixed(2),
            };
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Endpoint: GET /portfolio/date/:date/:token
 * Given a date and a token, return the portfolio value of that token in USD on that date.
 */
app.get('/portfolio/date/:date/:token', async (req, res) => {
    try {
        const dateParam = req.params.date;
        const tokenParam = req.params.token.toUpperCase();
        const cutoffTimestamp = parseCutoffTimestamp(dateParam);
        const portfolioMap = await computePortfolioStream(cutoffTimestamp);
        const balance = portfolioMap.get(tokenParam) || 0;
        const rates = await getRates([tokenParam], cutoffTimestamp);
        const rate = rates[tokenParam] || 0;
        res.json({
            token: tokenParam,
            balance,
            usdValue: +(balance * rate).toFixed(2),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
