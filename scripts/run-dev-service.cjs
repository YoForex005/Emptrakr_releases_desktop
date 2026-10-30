#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const separator = process.argv.indexOf('--');
const options = process.argv.slice(2, separator === -1 ? undefined : separator);
const command = separator === -1 ? [] : process.argv.slice(separator + 1);

function option(name) {
    const index = options.indexOf(name);
    return index === -1 ? undefined : options[index + 1];
}

const name = option('--name');
const urlText = option('--url');
const healthyDetail = option('--healthy-detail');
const timeoutSeconds = Number(option('--timeout') || 60);

if (!name || !urlText || command.length === 0 || !Number.isFinite(timeoutSeconds) || timeoutSeconds < 1) {
    console.error('Usage: node run-dev-service.cjs --name <service> --url <health URL> [--timeout <seconds>] -- <command> [args...]');
    process.exit(2);
}

let healthUrl;
try {
    healthUrl = new URL(urlText);
} catch {
    console.error(`[${name}] Invalid health URL: ${urlText}`);
    process.exit(2);
}

const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command.join(' ')], { stdio: 'inherit' })
    : spawn(command[0], command.slice(1), { stdio: 'inherit' });
let healthy = false;
let stopping = false;

function reportHealthy() {
    if (healthy) return;
    healthy = true;
    const detail = healthyDetail ? ` ${healthyDetail}` : '';
    console.log(`\n[HEALTHY] ${name} is running and responding at ${urlText}${detail}`);
}

function reportUnhealthy(detail) {
    if (healthy) console.error(`\n[CONNECTION PROBLEM] ${name} stopped responding at ${urlText}: ${detail}`);
    healthy = false;
}

function checkHealth() {
    const client = healthUrl.protocol === 'https:' ? https : http;
    const request = client.get(healthUrl, { timeout: 2500 }, response => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 400) reportHealthy();
        else reportUnhealthy(`HTTP ${response.statusCode}`);
    });
    request.on('timeout', () => request.destroy(new Error('request timed out')));
    request.on('error', error => reportUnhealthy(error.message));
}

console.log(`[STARTING] ${name} development service; checking ${urlText}`);
checkHealth();
const interval = setInterval(checkHealth, 3000);
const startupTimeout = setTimeout(() => {
    if (!healthy) console.error(`\n[CONNECTION PROBLEM] ${name} did not become healthy at ${urlText} within ${timeoutSeconds} seconds.`);
}, timeoutSeconds * 1000);

function stop(signal) {
    stopping = true;
    clearInterval(interval);
    clearTimeout(startupTimeout);
    if (!child.killed) child.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
child.on('error', error => {
    clearInterval(interval);
    clearTimeout(startupTimeout);
    console.error(`\n[CONNECTION PROBLEM] ${name} could not start: ${error.message}`);
    process.exit(1);
});
child.on('exit', (code, signal) => {
    clearInterval(interval);
    clearTimeout(startupTimeout);
    if (!stopping && code !== 0) console.error(`\n[CONNECTION PROBLEM] ${name} development command stopped (exit code ${code ?? 'unknown'}${signal ? `, signal ${signal}` : ''}).`);
    else if (!stopping) console.log(`\n[STOPPED] ${name} development service stopped.`);
    process.exit(code ?? 0);
});
