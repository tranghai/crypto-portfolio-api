# Crypto Portfolio API

This project implements a Node.js API that calculates a crypto portfolio's value based on a CSV file containing transactions. The API supports the following operations:

- **No parameters:** Returns the latest portfolio value per token in USD.
- **Token only:** Returns the latest portfolio value for the specified token in USD.
- **Date only:** Returns the portfolio value per token in USD as of the given date.
- **Date and Token:** Returns the portfolio value for the specified token in USD as of the given date.

The CSV file is expected to have the following columns:
- `timestamp`: Integer number of seconds since the Epoch.
- `transaction_type`: Either `DEPOSIT` or `WITHDRAWAL`.
- `token`: The token symbol.
- `amount`: The amount transacted.

Exchange rates are retrieved from the CryptoCompare API (using both the latest and historical endpoints).

---

## Directory Structure

src/
 ├── app.js                # Express API server and endpoint definitions
 ├── portfolioService.js   # Service layer for streaming CSV, computing portfolio, and fetching exchange rates
 └── transactions.csv      # CSV file with crypto transactions

## Installation
1. Clone the repository:
```
git clone https://your-repo-url.git
cd your-repo-directory
```

2. Install dependencies:
```
npm install
```

3. Set up your CSV file:
Ensure that transactions.csv is placed in the src folder with the required columns.

## Usage
Run the server with:
```
node src/app.js
```

The server listens on port 3000 (or the port specified in the PORT environment variable).

## API Endpoints
- GET /portfolio
Returns the latest portfolio for all tokens in USD.

- GET /portfolio/:token
Returns the latest portfolio for the specified token in USD.

- GET /portfolio/date/:date
Returns the portfolio for all tokens as of the specified date (format: YYYY-MM-DD).

- GET /portfolio/date/:date/:token
Returns the portfolio for the specified token as of the specified date.