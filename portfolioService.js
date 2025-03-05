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
let portfolioCache = new Map();
let lastCutoffTimestamp = null;

/**
* Get rates from CryptoCompare using batch call for multiple tokens at once.
* If no timestamp => get latest rates.
* rateMap: { token: USD rate, ... }
*/
export async function getRates(tokens, ts = null) {
    const tokenList = [...new Set(tokens)]; // Loại bỏ trùng lặp
    const cacheKey = ts ? `historical_${tokenList.join(',')}_${ts}` : `latest_${tokenList.join(',')}`;

    if (rateCache.has(cacheKey)) {
        const { rateMap, timestamp } = rateCache.get(cacheKey);
        if (Date.now() - timestamp < CACHE_TTL) {
            return rateMap;
        }
    }

    const url = ts
        ? `${API_URL}/pricehistorical?fsym=${tokenList[0]}&tsyms=USD&ts=${ts}`
        : `${API_URL}/pricemulti?fsyms=${tokenList.join(',')}&tsyms=USD`;

    const rateMap = await fetchRates(url, tokenList, ts);
    rateCache.set(cacheKey, { rateMap, timestamp: Date.now() });
    return rateMap;
}

async function fetchRates(url, tokens, ts) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error getting exchange rate: ${response.statusText}`);

        const data = await response.json();
        return tokens.reduce((rateMap, token) => {
            rateMap[token] = ts ? (data[token]?.USD || 0) : (data[token]?.USD || 0);
            return rateMap;
        }, {});
    } catch (error) {
        console.error("Fetch error:", error);
        return tokens.reduce((rateMap, token) => ({ ...rateMap, [token]: 0 }), {});
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
