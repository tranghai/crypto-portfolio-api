import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvFilePath = path.join(__dirname, 'transactions.csv');

const rateCache = new Map();
const CACHE_TTL = 60 * 1000;
const API_URL = "https://min-api.cryptocompare.com/data";
const TSYMS = 'USD'
let portfolioCache = new Map();
let lastCutoffTimestamp = null;

/**
* Get rates from CryptoCompare using batch call for multiple tokens at once.
* If no timestamp => get latest rates.
* rateMap: { token: USD rate, ... }
*/
export async function getRates(tokens, ts) {
    const tokenList = Array.from(new Set(tokens));
    if (!ts) {
        const cacheKey = `batch_latest_${tokenList.sort().join(',')}`;
        const now = Date.now();
        if (rateCache.has(cacheKey)) {
            const { rateMap, timestamp } = rateCache.get(cacheKey);
            if (now - timestamp < CACHE_TTL) {
                return rateMap;
            }
        }
        const symbols = tokenList.join(',');
        const url = `${API_URL}/pricemulti?fsyms=${symbols}&tsyms=${TSYMS}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error getting exchange rate: ${response.statusText}`);
        }
        const data = await response.json();
        const rateMap = {};
        tokenList.forEach(token => {
            rateMap[token] = data[token]?.USD || 0;
        });
        rateCache.set(cacheKey, { rateMap, timestamp: now });
        return rateMap;
    } else {
        const now = Date.now();
        const rateMap = {};
        await Promise.all(
            tokenList.map(async (token) => {
                const key = `${token}_${ts}`;
                if (rateCache.has(key)) {
                    const { rate, timestamp } = rateCache.get(key);
                    if (now - timestamp < CACHE_TTL) {
                        rateMap[token] = rate;
                        return;
                    }
                }
                const url = `${API_URL}/pricehistorical?fsym=${token}&tsyms=${TSYMS}&ts=${ts}`;
                const response = await fetch(url);
                if (!response.ok) {
                    rateMap[token] = 0;
                    return;
                }
                const data = await response.json();
                const rate = data[token]?.USD || 0;
                rateCache.set(key, { rate, timestamp: now });
                rateMap[token] = rate;
            })
        );
        return rateMap;
    }
}

/**
* Calculate portfolio by streaming through CSV file.
* Only count records with timestamp <= cutoffTimestamp.
* Return Map: key = token, value = balance.
*/
export function computePortfolioStream(cutoffTimestamp) {
    return new Promise((resolve, reject) => {
        const portfolio = new Map();
        if (portfolioCache.size > 0 && lastCutoffTimestamp && (cutoffTimestamp - lastCutoffTimestamp < CACHE_TTL)) {
            return resolve(portfolioCache);
        }

        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (data) => {
                try {
                    const ts = parseInt(data.timestamp, 10);
                    if (ts <= cutoffTimestamp) {
                        const token = data.token.toUpperCase();
                        const amount = parseFloat(data.amount);
                        const prev = portfolio.get(token) || 0;
                        if (data.transaction_type === 'DEPOSIT') {
                            portfolio.set(token, prev + amount);
                        } else if (data.transaction_type === 'WITHDRAWAL') {
                            portfolio.set(token, prev - amount);
                        }
                    }
                } catch (err) {
                    console.error('Record processing error:', err);
                }
            })
            .on('end', () => {
                portfolioCache = portfolio;
                lastCutoffTimestamp = cutoffTimestamp;
                resolve(portfolio);
            })
            .on('error', reject);
    });
}
