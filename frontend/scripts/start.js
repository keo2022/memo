const os = require('os');
const { spawnSync } = require('child_process');

function pickLanIp() {
  const ifaces = os.networkInterfaces();

  // Prefer common physical adapter names over VPN/virtual adapters (VMware, etc.)
  const preferredNames = ['Wi-Fi', 'WLAN', 'Ethernet', 'wlan0', 'eth0'];
  for (const name of preferredNames) {
    const addrs = ifaces[name];
    if (!addrs) continue;
    const v4 = addrs.find((a) => a.family === 'IPv4' && !a.internal);
    if (v4) return v4.address;
  }

  // Fallback: any non-internal IPv4 that isn't a link-local/APIPA address.
  for (const addrs of Object.values(ifaces)) {
    const v4 = addrs.find(
      (a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')
    );
    if (v4) return v4.address;
  }

  return null;
}

const ip = pickLanIp();
const env = { ...process.env };

if (ip) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  console.log(`[start] Expo dev server host set to ${ip} (Expo Go에서 이 IP로 접속됩니다)`);
} else {
  console.warn('[start] LAN IP를 찾지 못해 Expo 기본 동작(localhost로 폴백될 수 있음)을 사용합니다.');
}

const extraArgs = process.argv.slice(2);
const result = spawnSync('npx', ['expo', 'start', '--lan', ...extraArgs], {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status ?? 0);
