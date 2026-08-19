// windows-server/src/network.js
const os = require('os');
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name: name,
          address: iface.address
        });
      }
    }
  }

  // Prioritize Ethernet 2 (USB Hotspot) or Wi-Fi
  addresses.sort((a, b) => {
    const isUsbA = a.name.toLowerCase().includes('ethernet 2') || a.name.toLowerCase().includes('iphone');
    const isUsbB = b.name.toLowerCase().includes('ethernet 2') || b.name.toLowerCase().includes('iphone');
    if (isUsbA && !isUsbB) return -1;
    if (!isUsbA && isUsbB) return 1;
    return 0;
  });

  return addresses;
}

async function getOrCreateCertificates() {
  const certDir = path.join(__dirname, '..', 'certs');
  const certPath = path.join(certDir, 'cert.pem');
  const keyPath = path.join(certDir, 'key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const cert = fs.readFileSync(certPath, 'utf8');
    const key = fs.readFileSync(keyPath, 'utf8');
    if (cert && key && cert.length > 50 && key.length > 50) {
      return { cert, key };
    }
  }

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  console.log('[Network] Generating SSL certificates for HTTPS (required for iOS Safari AR/Sensors)...');
  const ips = getLocalIPAddresses().map(ip => ip.address);
  const pems = await selfsigned.generate([
    { name: 'commonName', value: 'SpatialVR' },
    { name: 'organizationName', value: 'SpatialVR Desktop' }
  ], {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          ...ips.map(ip => ({ type: 7, ip }))
        ]
      }
    ]
  });

  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private);

  return {
    cert: pems.cert,
    key: pems.private
  };
}

module.exports = {
  getLocalIPAddresses,
  getOrCreateCertificates
};
