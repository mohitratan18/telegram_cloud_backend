#!/usr/bin/env node

/**
 * Health Monitor Script
 * Checks API health every 1 second and logs status
 */

const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:5000';
const CHECK_INTERVAL = 1000; // 1 second

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

let consecutiveFailures = 0;
let consecutiveSuccesses = 0;
let totalChecks = 0;
let totalFailures = 0;

function formatTimestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function getStatusColor(status) {
    switch (status) {
        case 'ok':
        case 'healthy':
            return colors.green;
        case 'degraded':
            return colors.yellow;
        case 'unhealthy':
            return colors.red;
        default:
            return colors.gray;
    }
}

function logHealth(statusCode, data) {
    totalChecks++;
    const timestamp = formatTimestamp();
    const status = data?.status || 'unknown';
    const color = getStatusColor(status);

    if (statusCode === 200) {
        consecutiveSuccesses++;
        consecutiveFailures = 0;

        console.log(
            `${colors.gray}[${timestamp}]${colors.reset} ` +
            `${color}✓ ${statusCode}${colors.reset} - ` +
            `Status: ${color}${status.toUpperCase()}${colors.reset} | ` +
            `Uptime: ${Math.floor(data.uptime)}s | ` +
            `DB: ${getStatusColor(data.checks?.database)}${data.checks?.database || 'unknown'}${colors.reset} | ` +
            `Telegram: ${getStatusColor(data.checks?.telegram)}${data.checks?.telegram || 'unknown'}${colors.reset} | ` +
            `Storage: ${getStatusColor(data.checks?.storage)}${data.checks?.storage || 'unknown'}${colors.reset}`
        );
    } else {
        consecutiveFailures++;
        consecutiveSuccesses = 0;
        totalFailures++;

        console.log(
            `${colors.gray}[${timestamp}]${colors.reset} ` +
            `${colors.red}✗ ${statusCode}${colors.reset} - ` +
            `Status: ${color}${status.toUpperCase()}${colors.reset}`
        );

        if (data?.checks) {
            Object.entries(data.checks).forEach(([key, value]) => {
                if (key.includes('Error')) {
                    console.log(`  ${colors.red}└─ ${key}: ${value}${colors.reset}`);
                }
            });
        }
    }

    // Alert on consecutive failures
    if (consecutiveFailures === 5) {
        console.log(`${colors.red}⚠️  WARNING: 5 consecutive health check failures!${colors.reset}`);
    } else if (consecutiveFailures === 10) {
        console.log(`${colors.red}🚨 CRITICAL: 10 consecutive health check failures!${colors.reset}`);
    }

    // Show recovery message
    if (consecutiveSuccesses === 1 && totalChecks > 1) {
        console.log(`${colors.green}✓ Service recovered after ${totalFailures} total failures${colors.reset}`);
    }
}

function logError(error) {
    totalChecks++;
    totalFailures++;
    consecutiveFailures++;
    consecutiveSuccesses = 0;

    const timestamp = formatTimestamp();
    
    if (error.code === 'ECONNREFUSED') {
        console.log(
            `${colors.gray}[${timestamp}]${colors.reset} ` +
            `${colors.red}✗ CONNECTION REFUSED${colors.reset} - ` +
            `Cannot connect to ${API_URL}`
        );
    } else if (error.code === 'ETIMEDOUT') {
        console.log(
            `${colors.gray}[${timestamp}]${colors.reset} ` +
            `${colors.red}✗ TIMEOUT${colors.reset} - ` +
            `Request timed out`
        );
    } else {
        console.log(
            `${colors.gray}[${timestamp}]${colors.reset} ` +
            `${colors.red}✗ ERROR${colors.reset} - ` +
            `${error.message}`
        );
    }
}

async function checkHealth() {
    try {
        const response = await axios.get(`${API_URL}/health`, {
            timeout: 5000,
            validateStatus: () => true // Accept any status code
        });

        logHealth(response.status, response.data);
    } catch (error) {
        logError(error);
    }
}

// Print header
console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║          API Health Monitor - Checking every 1s            ║${colors.reset}`);
console.log(`${colors.cyan}║  Target: ${API_URL.padEnd(48)} ║${colors.reset}`);
console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
console.log('');

// Start monitoring
checkHealth(); // Initial check
const interval = setInterval(checkHealth, CHECK_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n');
    console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║                    Monitoring Summary                      ║${colors.reset}`);
    console.log(`${colors.cyan}╠════════════════════════════════════════════════════════════╣${colors.reset}`);
    console.log(`${colors.cyan}║${colors.reset}  Total Checks: ${totalChecks.toString().padEnd(44)} ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}║${colors.reset}  Total Failures: ${totalFailures.toString().padEnd(42)} ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}║${colors.reset}  Success Rate: ${((totalChecks - totalFailures) / totalChecks * 100).toFixed(2)}%`.padEnd(59) + ` ${colors.cyan}║${colors.reset}`);
    console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log('');
    process.exit(0);
});

// Handle errors
process.on('uncaughtException', (error) => {
    console.error(`${colors.red}Uncaught Exception:${colors.reset}`, error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`${colors.red}Unhandled Rejection:${colors.reset}`, reason);
});
