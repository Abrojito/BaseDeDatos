const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = "./movies.db"; // Replace with the actual path to your SQLite database
const INDEX_FILE_PATH = path.join(__dirname, "search_index.json");

// Function to build index
async function buildIndex() {
    const db = new sqlite3.Database(DB_PATH);

    const index = {
        movies: { fullTitles: {}, tokens: {} },
        people: { fullNames: {}, tokens: {} },
    };

    // Index movie titles
    await new Promise((resolve, reject) => {
        db.all("SELECT movie_id, title FROM movie", (err, rows) => {
            if (err) return reject(err);
            rows.forEach((row) => {
                const title = row.title.toLowerCase();

                // Store the full title
                index.movies.fullTitles[title] = index.movies.fullTitles[title] || [];
                index.movies.fullTitles[title].push({
                    id: row.movie_id,
                    title: row.title,
                });

                // Tokenize and store each word
                const tokens = title.split(" ");
                tokens.forEach((token) => {
                    index.movies.tokens[token] = index.movies.tokens[token] || [];
                    index.movies.tokens[token].push({
                        id: row.movie_id,
                        title: row.title,
                    });
                });
            });
            resolve();
        });
    });

    // Index person names
    await new Promise((resolve, reject) => {
        db.all("SELECT person_id, person_name FROM person", (err, rows) => {
            if (err) return reject(err);
            rows.forEach((row) => {
                const name = row.person_name.toLowerCase();

                // Store the full name
                index.people.fullNames[name] = index.people.fullNames[name] || [];
                index.people.fullNames[name].push({
                    id: row.person_id,
                    name: row.person_name,
                });

                // Tokenize and store each word
                const tokens = name.split(" ");
                tokens.forEach((token) => {
                    index.people.tokens[token] = index.people.tokens[token] || [];
                    index.people.tokens[token].push({
                        id: row.person_id,
                        name: row.person_name,
                    });
                });
            });
            resolve();
        });
    });

    // Close the database connection
    db.close();

    // Save the index to a file
    fs.writeFileSync(INDEX_FILE_PATH, JSON.stringify(index, null, 2));
    return index;
}

// Load or create index on startup
function loadIndex() {
    if (fs.existsSync(INDEX_FILE_PATH)) {
        const data = fs.readFileSync(INDEX_FILE_PATH);
        return JSON.parse(data);
    } else {
        return buildIndex();
    }
}

const index = loadIndex();

// Levenshtein Distance Function for Fuzzy Matching
function levenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            matrix[i][j] =
                a[i - 1] === b[j - 1]
                    ? matrix[i - 1][j - 1]
                    : Math.min(
                        matrix[i - 1][j] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j - 1] + 1
                    );
        }
    }
    return matrix[a.length][b.length];
}

// Exact and Fuzzy Phrase Search
function exactOrFuzzyPhraseSearch(fullIndex, query, threshold = 2) {
    const lowerQuery = query.toLowerCase();

    // Check for an exact match in the full titles or names
    if (fullIndex[lowerQuery]) {
        return fullIndex[lowerQuery];
    }

    // If no exact match, perform fuzzy matching on full titles or names
    const fuzzyMatches = [];
    for (const key in fullIndex) {
        if (levenshtein(lowerQuery, key) <= threshold) {
            fuzzyMatches.push(...fullIndex[key]);
        }
    }
    return fuzzyMatches;
}

// Tokenized Exact Search
function exactSearch(index, terms) {
    const results = terms.reduce((acc, term) => {
        if (index[term]) {
            acc.push(...index[term]);
        }
        return acc;
    }, []);
    // Remove duplicates
    return Array.from(new Set(results.map((item) => item.id))).map((id) =>
        results.find((item) => item.id === id)
    );
}

// Fuzzy Search on Tokens
function fuzzySearch(data, query, field, threshold = 2) {
    return data.filter((item) => {
        const words = item[field].toLowerCase().split(" ");
        return words.some(
            (word) => levenshtein(query.toLowerCase(), word) <= threshold
        );
    });
}

// Combined Search (Prioritizing Full Phrase Match, then Tokenized and Fuzzy) with Limit
function combinedSearch(query, fullIndex, tokenIndex, data, field, limit = 10) {
    const lowerQuery = query.toLowerCase();

    // 1. Exact or fuzzy full phrase match
    const exactOrFuzzyMatches = exactOrFuzzyPhraseSearch(fullIndex, lowerQuery);

    // 2. Tokenized exact match (if exact or fuzzy phrase matches are not enough)
    const terms = lowerQuery.split(" ");
    const tokenizedMatches = exactSearch(tokenIndex, terms).filter(
        (item) => !exactOrFuzzyMatches.includes(item)
    );

    // 3. Fuzzy match on individual tokens (for remaining results up to the limit)
    const fuzzyMatches = fuzzySearch(data, query, field).filter(
        (item) =>
            !exactOrFuzzyMatches.includes(item) && !tokenizedMatches.includes(item)
    );

    // Combine results, prioritizing exact/fuzzy phrase matches first, then tokenized, then fuzzy
    const combinedResults = [
        ...exactOrFuzzyMatches,
        ...tokenizedMatches,
        ...fuzzyMatches,
    ];

    // Remove duplicates based on 'id' and limit the results
    const uniqueResults = Array.from(
        new Set(combinedResults.map((item) => item.id))
    )
        .map((id) => combinedResults.find((item) => item.id === id))
        .slice(0, limit);

    return uniqueResults;
}

// Search Functions with Limit
function searchMovies(query) {
    return combinedSearch(
        query,
        index.movies.fullTitles,
        index.movies.tokens,
        Object.values(index.movies.tokens).flat(),
        "title",
        10
    );
}

function searchPeople(query) {
    return combinedSearch(
        query,
        index.people.fullNames,
        index.people.tokens,
        Object.values(index.people.tokens).flat(),
        "name",
        10
    );
}

// Example usage
(async () => {
    await buildIndex(); // Build the index only if needed
    console.log("Movie Search:", searchMovies("Star Wars"));
    console.log("Person Search:", searchPeople("Nolan"));
})();

module.exports = { searchMovies, searchPeople };
